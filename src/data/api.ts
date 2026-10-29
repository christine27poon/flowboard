import type { Database } from './database.types'
import { supabase } from './supabase'
import type { Board, Card, Priority, Status, Workspace } from '../types'

type BoardRow = Database['public']['Tables']['boards']['Row']
type CardRow = Database['public']['Tables']['cards']['Row']

/** Error text safe to show: our own limit messages (raised by the database) pass through. */
const OWN_MESSAGE = /^(Board|Card) limit reached|^Import is too large|^Import data is not/

function field(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>)[key] : undefined
}

/**
 * A short, plain message for the person using the app. Server errors can name tables, columns and
 * policies, so they are never shown as-is (in development they go to the console instead).
 */
export function messageOf(error: unknown): string {
  if (import.meta.env.DEV) console.error(error)

  const code = String(field(error, 'code') ?? '')
  const status = Number(field(error, 'status') ?? 0)
  const message = String(field(error, 'message') ?? '')

  if (OWN_MESSAGE.test(message)) return message
  if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Can’t reach the server. Check your connection and try again.'
  }
  if (code === 'invalid_credentials') return 'That email and password don’t match.'
  if (code === 'email_not_confirmed') return 'Confirm your email first: check your inbox for the link.'
  if (code === 'weak_password') return 'That password is too easy to guess. Try a longer or less common one.'
  if (code === 'signup_disabled') return 'New accounts can’t be created right now.'
  if (code === 'user_already_exists' || code === 'email_exists') {
    return 'Couldn’t create that account. Try signing in instead.'
  }
  if (status === 429 || code.startsWith('over_')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (code === '42501' || status === 401 || status === 403 || /not authenticated|jwt/i.test(message)) {
    return 'Your session may have expired. Sign in again and retry.'
  }
  if (code === '23514' || code === '22001') return 'Some of that information isn’t valid.'
  return 'Something went wrong. Please try again.'
}

/** PostgREST errors are plain objects; turn them into real Errors (keeping the code) so callers can catch uniformly. */
function check(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
}

function toBoard(row: BoardRow): Board {
  return { id: row.id, name: row.name, position: row.position }
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    assignee: row.assignee,
    priority: row.priority as Priority,
    dueDate: row.due_date,
    status: row.status as Status,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * PostgREST caps each response (1,000 rows by default), so read in pages until one comes back
 * short. Kept below that cap so a project with a lower limit still pages correctly.
 */
const PAGE_SIZE = 500

async function fetchAllRows<Row>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    check(error)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
}

// `id` is the last sort key so rows with equal positions keep a stable order across pages.
async function fetchBoards(): Promise<Board[]> {
  const rows = await fetchAllRows<BoardRow>((from, to) =>
    supabase
      .from('boards')
      .select('*')
      .order('position')
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  return rows.map(toBoard)
}

async function fetchCards(): Promise<Card[]> {
  const rows = await fetchAllRows<CardRow>((from, to) =>
    supabase
      .from('cards')
      .select('*')
      .order('position')
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  return rows.map(toCard)
}

/** Everything the signed-in user owns. Creates the starter board first if they have none. */
export async function fetchWorkspaceData(): Promise<{ boards: Board[]; cards: Card[] }> {
  let [boards, cards] = await Promise.all([fetchBoards(), fetchCards()])
  if (boards.length === 0) {
    check((await supabase.rpc('ensure_default_board')).error)
    boards = await fetchBoards()
  }
  return { boards, cards }
}

export async function insertBoard(board: Board): Promise<void> {
  check((await supabase.from('boards').insert({ ...board })).error)
}

export async function updateBoardName(id: string, name: string): Promise<void> {
  check((await supabase.from('boards').update({ name }).eq('id', id)).error)
}

/** Cards on the board go with it (foreign key cascade). */
export async function deleteBoardById(id: string): Promise<void> {
  check((await supabase.from('boards').delete().eq('id', id)).error)
}

export async function insertCard(card: Card): Promise<void> {
  // Timestamps are set by the database, so they are not sent.
  const { boardId, dueDate, createdAt: _c, updatedAt: _u, ...rest } = card
  check((await supabase.from('cards').insert({ ...rest, board_id: boardId, due_date: dueDate })).error)
}

export async function updateCardById(card: Card): Promise<void> {
  const { id, boardId, dueDate, createdAt: _c, updatedAt: _u, ...rest } = card
  check(
    (await supabase.from('cards').update({ ...rest, board_id: boardId, due_date: dueDate }).eq('id', id))
      .error,
  )
}

export async function placeCard(id: string, status: Status, position: number): Promise<void> {
  check((await supabase.from('cards').update({ status, position }).eq('id', id)).error)
}

export async function deleteCardById(id: string): Promise<void> {
  check((await supabase.from('cards').delete().eq('id', id)).error)
}

/** Copies a localStorage workspace into the account in one transaction (see import_workspace). */
export async function importWorkspace(local: Workspace): Promise<void> {
  const payload = {
    boards: local.boards.map((b) => ({ id: b.id, name: b.name })),
    cards: local.cards.map((c) => ({
      board_id: c.boardId,
      title: c.title,
      assignee: c.assignee,
      priority: c.priority,
      due_date: c.dueDate,
      status: c.status,
      description: c.description,
    })),
  }
  check((await supabase.rpc('import_workspace', { payload })).error)
}
