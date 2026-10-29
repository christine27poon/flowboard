import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../test/fakeSupabase'
import { boardRow, cardRow, isoDay, makeBoard, makeCard } from '../test/fixtures'
import * as api from './api'

beforeEach(() => {
  // messageOf logs the raw error in development; keep the test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('messageOf: what people see when something fails', () => {
  const friendly: [string, unknown, string][] = [
    ['wrong password', { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }, 'That email and password don’t match.'],
    ['unconfirmed email', { message: 'Email not confirmed', code: 'email_not_confirmed' }, 'Confirm your email first: check your inbox for the link.'],
    ['weak password', { message: 'Password is known to be weak', code: 'weak_password' }, 'That password is too easy to guess. Try a longer or less common one.'],
    ['existing account', { message: 'User already registered', code: 'user_already_exists' }, 'Couldn’t create that account. Try signing in instead.'],
    ['rate limit (status)', { message: 'Too many requests', status: 429 }, 'Too many attempts. Wait a minute and try again.'],
    ['rate limit (code)', { message: 'slow down', code: 'over_request_rate_limit' }, 'Too many attempts. Wait a minute and try again.'],
    ['row-level security', { message: 'new row violates row-level security policy for table "cards"', code: '42501' }, 'Your session may have expired. Sign in again and retry.'],
    ['expired session', { message: 'JWT expired' }, 'Your session may have expired. Sign in again and retry.'],
    ['check constraint', { message: 'new row for relation "cards" violates check constraint "cards_title_check"', code: '23514' }, 'Some of that information isn’t valid.'],
    ['network failure', new TypeError('Failed to fetch'), 'Can’t reach the server. Check your connection and try again.'],
  ]

  it.each(friendly)('turns %s into plain language', (_name, error, expected) => {
    expect(api.messageOf(error)).toBe(expected)
  })

  it('passes through only our own limit messages', () => {
    for (const message of [
      'Board limit reached (100 per account)',
      'Card limit reached (5000 per account)',
      'Import is too large (at most 100 boards and 5000 cards)',
      'Import data is not in the expected format',
    ]) {
      expect(api.messageOf({ message })).toBe(message)
    }
  })

  it('never shows raw server text (table, column or constraint names)', () => {
    const raw = [
      'duplicate key value violates unique constraint "boards_pkey"',
      'relation "public.cards" does not exist',
      'column "createdAt" of relation "cards" does not exist',
      'permission denied for table boards',
      'insert or update on table "cards" violates foreign key constraint "cards_board_id_fkey"',
    ]
    for (const message of raw) {
      const shown = api.messageOf({ message })
      expect(shown).toBe('Something went wrong. Please try again.')
      expect(shown).not.toContain('cards')
      expect(shown).not.toContain('boards')
    }
  })

  it('reports being offline before anything else', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      expect(api.messageOf({ message: 'whatever' })).toBe(
        'Can’t reach the server. Check your connection and try again.',
      )
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    }
  })

  it('copes with non-error values', () => {
    expect(api.messageOf(undefined)).toBe('Something went wrong. Please try again.')
    expect(api.messageOf('boom')).toBe('Something went wrong. Please try again.')
  })
})

describe('reading', () => {
  it('pages through everything instead of stopping at the server cap', async () => {
    const cards = Array.from({ length: 1200 }, (_, i) => cardRow(makeCard({ boardId: 'b1', position: i + 1 })))
    db.reset({ boards: [boardRow(makeBoard({ id: 'b1' }))], cards })

    const data = await api.fetchWorkspaceData()

    expect(data.cards).toHaveLength(1200)
    expect(data.cards[0].position).toBe(1)
    expect(data.cards[1199].position).toBe(1200)
    // 500 + 500 + 200: the short last page ends the loop.
    expect(db.callsTo('select', 'cards')).toHaveLength(3)
  })

  it('creates the starter board for a brand-new account', async () => {
    db.reset()
    const data = await api.fetchWorkspaceData()
    expect(data.boards.map((b) => b.name)).toEqual(['My Board'])
    expect(db.calls.some((c) => c.op === 'rpc' && c.table === 'ensure_default_board')).toBe(true)
  })

  it('maps database columns to the app shape, timestamps included', async () => {
    const card = makeCard({ boardId: 'b1', title: 'Mapped', dueDate: '2031-02-03', updatedAt: '2031-01-01T00:00:00.000Z' })
    db.reset({ boards: [boardRow(makeBoard({ id: 'b1' }))], cards: [cardRow(card)] })
    const [loaded] = (await api.fetchWorkspaceData()).cards
    expect(loaded).toMatchObject({ title: 'Mapped', boardId: 'b1', dueDate: '2031-02-03', updatedAt: '2031-01-01T00:00:00.000Z' })
  })
})

describe('writing', () => {
  beforeEach(() => db.reset({ boards: [boardRow(makeBoard({ id: 'b1' }))] }))

  // The database sets the timestamps; sending camelCase keys makes it reject the request.
  it('does not send timestamps (or any camelCase field) when inserting a card', async () => {
    await api.insertCard(makeCard({ boardId: 'b1', title: 'Fresh' }))

    const [call] = db.callsTo('insert', 'cards')
    const keys = Object.keys(call.payload as object)
    expect(keys).not.toContain('createdAt')
    expect(keys).not.toContain('updatedAt')
    expect(keys.every((k) => k === k.toLowerCase())).toBe(true)
    expect(db.cards.at(-1)).toMatchObject({ title: 'Fresh', board_id: 'b1' })
  })

  it('does not send timestamps when updating a card', async () => {
    const card = makeCard({ boardId: 'b1', title: 'Before' })
    await api.insertCard(card)
    await api.updateCardById({ ...card, title: 'After' })

    const [call] = db.callsTo('update', 'cards')
    expect(Object.keys(call.payload as object)).not.toContain('updatedAt')
    expect(db.cards.find((c) => c.id === card.id)?.title).toBe('After')
  })

  it('places and deletes cards', async () => {
    const card = makeCard({ boardId: 'b1' })
    await api.insertCard(card)
    await api.placeCard(card.id, 'done', 4.5)
    expect(db.cards.find((c) => c.id === card.id)).toMatchObject({ status: 'done', position: 4.5 })
    await api.deleteCardById(card.id)
    expect(db.cards.find((c) => c.id === card.id)).toBeUndefined()
  })

  it('deleting a board takes its cards with it', async () => {
    await api.insertCard(makeCard({ boardId: 'b1' }))
    await api.deleteBoardById('b1')
    expect(db.cards).toHaveLength(0)
  })

  it('keeps the database error code so callers can tell what happened', async () => {
    db.failNext('cards.insert', { message: 'bad title', code: '23514' })
    await expect(api.insertCard(makeCard({ boardId: 'b1' }))).rejects.toMatchObject({ code: '23514' })
  })

  it('surfaces the account limit with its own readable message', async () => {
    db.reset({ boards: Array.from({ length: 100 }, (_, i) => boardRow(makeBoard({ id: `x${i}` }))) })
    const error = await api.insertBoard(makeBoard({ id: 'one-too-many' })).catch((e: unknown) => e)
    expect(api.messageOf(error)).toBe('Board limit reached (100 per account)')
  })
})

describe('importing a saved workspace', () => {
  it('sends boards and cards in the shape the database function expects', async () => {
    db.reset()
    const board = makeBoard({ id: 'local-1', name: 'Imported' })
    const card = makeCard({ boardId: 'local-1', title: 'Old card', dueDate: isoDay(3) })
    await api.importWorkspace({ boards: [board], cards: [card], activeBoardId: board.id })

    const call = db.calls.find((c) => c.op === 'rpc' && c.table === 'import_workspace')
    expect(call).toBeDefined()
    const payload = (call!.payload as { payload: { boards: unknown[]; cards: Record<string, unknown>[] } }).payload
    expect(payload.boards).toEqual([{ id: 'local-1', name: 'Imported' }])
    expect(payload.cards[0]).toMatchObject({ board_id: 'local-1', title: 'Old card', due_date: isoDay(3) })
    expect(db.boards.map((b) => b.name)).toContain('Imported')
    expect(db.cards.map((c) => c.title)).toContain('Old card')
  })
})
