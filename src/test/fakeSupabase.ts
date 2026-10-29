import { vi } from 'vitest'

/**
 * An in-memory stand-in for the Supabase client, so tests never reach a real database.
 * It implements only what src/data/api.ts uses, and is deliberately strict like the real one:
 * writing a column the table doesn't have is an error (which is how a camelCase `createdAt`
 * leaking into a request would be caught), and the account limits are enforced.
 */

type Row = Record<string, unknown>
type Table = 'boards' | 'cards'
export interface FakeError {
  message: string
  code?: string
}

const COLUMNS: Record<Table, string[]> = {
  boards: ['id', 'user_id', 'name', 'position', 'created_at', 'updated_at'],
  cards: [
    'id',
    'user_id',
    'board_id',
    'title',
    'assignee',
    'priority',
    'due_date',
    'status',
    'description',
    'position',
    'created_at',
    'updated_at',
  ],
}
const LIMITS = { boards: 100, cards: 5000 }

interface Call {
  op: 'select' | 'insert' | 'update' | 'delete' | 'rpc'
  table: string
  payload?: unknown
  eq?: [string, unknown]
}

export const db = {
  boards: [] as Row[],
  cards: [] as Row[],
  calls: [] as Call[],
  failures: new Map<string, FakeError>(),
  userId: 'user-1',

  /** Start a test from a known state. Rows get server-side defaults, like the real database. */
  reset(seed: { boards?: Row[]; cards?: Row[] } = {}) {
    this.calls = []
    this.failures.clear()
    this.boards = []
    this.cards = []
    for (const b of seed.boards ?? []) this.boards.push(withDefaults('boards', b))
    for (const c of seed.cards ?? []) this.cards.push(withDefaults('cards', c))
  },

  /** Make the next `<table>.<op>` (e.g. "cards.insert") fail once with this error. */
  failNext(key: string, error: FakeError = { message: 'boom', code: 'XX000' }) {
    this.failures.set(key, error)
  },

  /** Calls of one kind, e.g. db.callsTo('insert', 'cards'). */
  callsTo(op: Call['op'], table: string) {
    return this.calls.filter((c) => c.op === op && c.table === table)
  },

  cardRows(): Row[] {
    return this.cards
  },
}

let counter = 0
function uuid(): string {
  counter += 1
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

function withDefaults(table: Table, row: Row): Row {
  const now = new Date().toISOString()
  const base: Row =
    table === 'boards'
      ? { id: uuid(), user_id: db.userId, position: 0, created_at: now, updated_at: now }
      : {
          id: uuid(),
          user_id: db.userId,
          priority: 'Medium',
          status: 'backlog',
          description: '',
          position: 0,
          created_at: now,
          updated_at: now,
        }
  return { ...base, ...row }
}

function unknownColumn(table: Table, payload: Row): FakeError | null {
  const bad = Object.keys(payload).find((k) => !COLUMNS[table].includes(k))
  return bad
    ? { message: `Could not find the '${bad}' column of '${table}' in the schema cache`, code: 'PGRST204' }
    : null
}

interface QueryState {
  op: 'select' | 'insert' | 'update' | 'delete'
  order: string[]
  range: [number, number] | null
  payload?: Row
  eq: [string, unknown] | null
}

function execute(table: Table, state: QueryState): { data: Row[] | null; error: FakeError | null } {
  db.calls.push({ op: state.op, table, payload: state.payload, eq: state.eq ?? undefined })

  const failure = db.failures.get(`${table}.${state.op}`)
  if (failure) {
    db.failures.delete(`${table}.${state.op}`)
    return { data: null, error: failure }
  }

  const rows = db[table]

  if (state.op === 'select') {
    const sorted = [...rows].sort((a, b) => {
      for (const key of state.order) {
        const x = a[key] as number | string
        const y = b[key] as number | string
        if (x < y) return -1
        if (x > y) return 1
      }
      return 0
    })
    const [from, to] = state.range ?? [0, sorted.length - 1]
    return { data: sorted.slice(from, to + 1).map((r) => ({ ...r })), error: null }
  }

  if (state.op === 'insert') {
    const payload = state.payload as Row
    const bad = unknownColumn(table, payload)
    if (bad) return { data: null, error: bad }
    if (rows.length >= LIMITS[table]) {
      const noun = table === 'boards' ? 'Board' : 'Card'
      return { data: null, error: { message: `${noun} limit reached (${LIMITS[table]} per account)` } }
    }
    const row = withDefaults(table, payload)
    if (table === 'cards' && !db.boards.some((b) => b.id === row.board_id)) {
      return { data: null, error: { message: 'violates foreign key constraint', code: '23503' } }
    }
    const title = String(row[table === 'boards' ? 'name' : 'title'] ?? '').trim()
    if (!title) return { data: null, error: { message: 'violates check constraint', code: '23514' } }
    rows.push(row)
    return { data: null, error: null }
  }

  if (state.op === 'update') {
    const bad = unknownColumn(table, state.payload as Row)
    if (bad) return { data: null, error: bad }
    const target = rows.find((r) => state.eq && r[state.eq[0]] === state.eq[1])
    if (target) Object.assign(target, state.payload, { updated_at: new Date().toISOString() })
    return { data: null, error: null }
  }

  // delete
  const keep = rows.filter((r) => !(state.eq && r[state.eq[0]] === state.eq[1]))
  const removedIds = rows.filter((r) => !keep.includes(r)).map((r) => r.id)
  db[table] = keep
  if (table === 'boards') db.cards = db.cards.filter((c) => !removedIds.includes(c.board_id))
  return { data: null, error: null }
}

function from(table: string) {
  const t = table as Table
  const state: QueryState = { op: 'select', order: [], range: null, eq: null }
  const query = {
    select() {
      return query
    },
    order(column: string) {
      state.order.push(column)
      return query
    },
    range(from: number, to: number) {
      state.range = [from, to]
      return query
    },
    insert(payload: Row) {
      state.op = 'insert'
      state.payload = payload
      return query
    },
    update(payload: Row) {
      state.op = 'update'
      state.payload = payload
      return query
    },
    delete() {
      state.op = 'delete'
      return query
    },
    eq(column: string, value: unknown) {
      state.eq = [column, value]
      return query
    },
    // Awaiting a query runs it, like the real builder.
    then<T>(resolve: (value: { data: Row[] | null; error: FakeError | null }) => T, reject?: (e: unknown) => T) {
      return Promise.resolve(execute(t, state)).then(resolve, reject)
    },
  }
  return query
}

async function rpc(name: string, args?: { payload?: unknown }): Promise<{ data: null; error: FakeError | null }> {
  db.calls.push({ op: 'rpc', table: name, payload: args })
  const failure = db.failures.get(`rpc.${name}`)
  if (failure) {
    db.failures.delete(`rpc.${name}`)
    return { data: null, error: failure }
  }

  if (name === 'ensure_default_board') {
    if (!db.boards.some((b) => b.user_id === db.userId)) {
      db.boards.push(withDefaults('boards', { name: 'My Board', position: 1 }))
    }
    return { data: null, error: null }
  }

  if (name === 'import_workspace') {
    const payload = args?.payload as { boards?: Row[]; cards?: Row[] } | undefined
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { data: null, error: { message: 'Import data is not in the expected format' } }
    }
    const boards = payload.boards ?? []
    const cards = payload.cards ?? []
    if (boards.length > LIMITS.boards || cards.length > LIMITS.cards) {
      return { data: null, error: { message: 'Import is too large (at most 100 boards and 5000 cards)' } }
    }
    const idMap = new Map<unknown, unknown>()
    boards.forEach((b, i) => {
      const row = withDefaults('boards', { name: b.name, position: db.boards.length + i + 1 })
      db.boards.push(row)
      idMap.set(b.id, row.id)
    })
    cards.forEach((c, i) => {
      if (!idMap.has(c.board_id)) return
      db.cards.push(withDefaults('cards', { ...c, board_id: idMap.get(c.board_id), position: i + 1 }))
    })
    return { data: null, error: null }
  }

  return { data: null, error: { message: `unknown function ${name}` } }
}

type AuthListener = (event: string, session: unknown) => void

export const authState = {
  session: null as null | { user: { id: string; email: string } },
  listeners: new Set<AuthListener>(),
  notify() {
    for (const listener of this.listeners) listener('SIGNED_IN', this.session)
  },
}

const auth = {
  getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
  onAuthStateChange: vi.fn((listener: AuthListener) => {
    authState.listeners.add(listener)
    return { data: { subscription: { unsubscribe: () => authState.listeners.delete(listener) } } }
  }),
  signInWithPassword: vi.fn(async (_credentials: { email: string; password: string }) => ({
    data: { session: null, user: null },
    error: null as null | { message: string; code?: string; status?: number },
  })),
  signUp: vi.fn(async (_credentials: { email: string; password: string }) => ({
    data: { session: null as unknown, user: null },
    error: null as null | { message: string; code?: string; status?: number },
  })),
  signOut: vi.fn(async () => {
    authState.session = null
    authState.notify()
    return { error: null }
  }),
}

export const fakeSupabase = { from, rpc, auth }

/** Put everything back to a clean, signed-out, empty state. Runs before every test. */
export function resetFakeSupabase() {
  db.reset()
  authState.session = null
  authState.listeners.clear()
  auth.getSession.mockClear()
  auth.signInWithPassword.mockReset()
  auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null })
  auth.signUp.mockReset()
  auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null })
}
