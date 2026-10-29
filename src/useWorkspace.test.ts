import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './test/fakeSupabase'
import { boardRow, cardRow, makeBoard, makeCard } from './test/fixtures'
import type { Card, CardDraft } from './types'
import { useWorkspace } from './useWorkspace'

const WORK = makeBoard({ id: 'b1', name: 'Work', position: 1 })
const HOME = makeBoard({ id: 'b2', name: 'Home', position: 2 })

const draft = (overrides: Partial<CardDraft> = {}): CardDraft => ({
  title: 'New card',
  assignee: 'Sam',
  priority: 'High',
  dueDate: '2031-01-01',
  status: 'backlog',
  description: 'notes',
  ...overrides,
})

/** Card rows for one column, in the order given (positions 1, 2, 3…). */
function seedColumn(ids: string[], status: Card['status'] = 'backlog', boardId = 'b1') {
  return ids.map((id, i) =>
    cardRow(makeCard({ id, title: `Card ${id}`, boardId, status, position: i + 1, updatedAt: '2020-01-01T00:00:00.000Z' })),
  )
}

async function loaded() {
  const hook = renderHook(() => useWorkspace('user-1'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

const ids = (cards: Card[], status: Card['status'] = 'backlog') =>
  cards.filter((c) => c.status === status).map((c) => c.id)

const dbRow = (id: string) => db.cards.find((c) => c.id === id)

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db.reset({ boards: [boardRow(WORK), boardRow(HOME)], cards: seedColumn(['a', 'b', 'c']) })
})

describe('loading', () => {
  it('reads boards and cards for the signed-in account', async () => {
    const { result } = await loaded()
    expect(result.current.boards.map((b) => b.name)).toEqual(['Work', 'Home'])
    expect(ids(result.current.cards)).toEqual(['a', 'b', 'c'])
    expect(result.current.activeBoardId).toBe('b1')
    expect(result.current.loadError).toBeNull()
  })

  it('creates a starter board when the account has none', async () => {
    db.reset()
    const { result } = await loaded()
    expect(result.current.boards.map((b) => b.name)).toEqual(['My Board'])
  })

  it('reports a load failure instead of crashing', async () => {
    db.failNext('boards.select', { message: 'down', code: 'XX000' })
    const { result } = renderHook(() => useWorkspace('user-1'))
    await waitFor(() => expect(result.current.loadError).toBe('Something went wrong. Please try again.'))
    expect(result.current.loading).toBe(false)
  })
})

describe('creating a card', () => {
  it('shows it at once, at the end of its column, then saves it', async () => {
    const { result } = await loaded()
    let created: ReturnType<typeof result.current.saveCard>
    act(() => {
      created = result.current.saveCard(draft({ title: 'Brand new' }))
    })

    // Optimistic: on screen before the server has answered.
    const card = result.current.cards.find((c) => c.title === 'Brand new')
    expect(card).toMatchObject({ boardId: 'b1', status: 'backlog', position: 4 })
    expect(card?.createdAt).toBeTruthy()

    expect(await created!.saved).toBe(true)
    expect(dbRow(created!.id)).toMatchObject({ title: 'Brand new', board_id: 'b1', assignee: 'Sam', due_date: '2031-01-01' })
  })

  it('files a card in the column it was created for', async () => {
    const { result } = await loaded()
    act(() => {
      result.current.saveCard(draft({ title: 'In review', status: 'in-review' }))
    })
    expect(ids(result.current.cards, 'in-review')).toHaveLength(1)
  })

  it('sends a clean row (no timestamps) so the database accepts it', async () => {
    const { result } = await loaded()
    let created: ReturnType<typeof result.current.saveCard>
    act(() => {
      created = result.current.saveCard(draft())
    })
    expect(await created!.saved).toBe(true)
    const [call] = db.callsTo('insert', 'cards')
    expect(Object.keys(call.payload as object)).not.toContain('createdAt')
  })
})

describe('editing a card', () => {
  it('updates its fields and refreshes its updated time', async () => {
    const { result } = await loaded()
    let edit: ReturnType<typeof result.current.saveCard>
    act(() => {
      edit = result.current.saveCard(draft({ title: 'Renamed', priority: 'Low', description: 'changed' }), 'b')
    })

    const card = result.current.cards.find((c) => c.id === 'b')!
    expect(card).toMatchObject({ title: 'Renamed', priority: 'Low', description: 'changed', position: 2 })
    expect(card.updatedAt > '2020-01-01T00:00:00.000Z').toBe(true)

    expect(await edit!.saved).toBe(true)
    expect(dbRow('b')).toMatchObject({ title: 'Renamed', priority: 'Low', position: 2 })
  })

  it('sends a card to the end of the new column when its column changes', async () => {
    db.reset({
      boards: [boardRow(WORK)],
      cards: [...seedColumn(['a', 'b']), ...seedColumn(['x', 'y'], 'done')],
    })
    const { result } = await loaded()
    let edit: ReturnType<typeof result.current.saveCard>
    act(() => {
      edit = result.current.saveCard(draft({ status: 'done' }), 'a')
    })
    expect(ids(result.current.cards, 'done')).toEqual(['x', 'y', 'a'])
    await edit!.saved
    expect(dbRow('a')).toMatchObject({ status: 'done', position: 3 })
  })

  it('ignores an edit to a card that no longer exists', async () => {
    const { result } = await loaded()
    expect(result.current.saveCard(draft(), 'ghost')).toBeUndefined()
  })
})

describe('moving a card', () => {
  const move = async (id: string, status: Card['status'], beforeId: string | null) => {
    const hook = await loaded()
    let saved: Promise<boolean>
    act(() => {
      saved = hook.result.current.moveCard(id, status, beforeId)
    })
    return { ...hook, saved: saved! }
  }

  it('puts a card before another one', async () => {
    const { result, saved } = await move('c', 'backlog', 'a')
    expect(ids(result.current.cards)).toEqual(['c', 'a', 'b'])
    expect(await saved).toBe(true)
    expect(dbRow('c')?.position).toBeLessThan(dbRow('a')!.position as number)
  })

  it('puts a card between two neighbours at the midpoint', async () => {
    const { result, saved } = await move('c', 'backlog', 'b')
    expect(ids(result.current.cards)).toEqual(['a', 'c', 'b'])
    await saved
    expect(dbRow('c')?.position).toBe(1.5)
  })

  it('sends a card to the end when there is nothing to go before', async () => {
    const { result, saved } = await move('a', 'backlog', null)
    expect(ids(result.current.cards)).toEqual(['b', 'c', 'a'])
    await saved
    expect(dbRow('a')?.position).toBe(4)
  })

  it('moves a card into another column', async () => {
    const { result, saved } = await move('a', 'done', null)
    expect(ids(result.current.cards, 'done')).toEqual(['a'])
    expect(ids(result.current.cards)).toEqual(['b', 'c'])
    await saved
    expect(dbRow('a')).toMatchObject({ status: 'done', position: 1 })
  })

  it('stamps the moved card as just updated', async () => {
    const { result } = await move('a', 'backlog', null)
    expect(result.current.cards.find((c) => c.id === 'a')!.updatedAt > '2020-01-01').toBe(true)
  })

  // Halving the gap forever would run out of precision, so a squeezed column is renumbered.
  it('renumbers a column whose neighbours have been squeezed together', async () => {
    db.reset({
      boards: [boardRow(WORK)],
      cards: [
        cardRow(makeCard({ id: 'a', boardId: 'b1', position: 1 })),
        cardRow(makeCard({ id: 'b', boardId: 'b1', position: 1 + 1e-7 })),
        cardRow(makeCard({ id: 'c', boardId: 'b1', position: 5 })),
      ],
    })
    const { result, saved } = await move('c', 'backlog', 'b')
    expect(ids(result.current.cards)).toEqual(['a', 'c', 'b'])
    expect(await saved).toBe(true)

    expect(dbRow('a')?.position).toBe(1)
    expect(dbRow('c')?.position).toBe(2)
    expect(dbRow('b')?.position).toBe(3)
    // Neighbours are rewritten first, then the moved card.
    expect(db.callsTo('update', 'cards').map((c) => c.eq?.[1])).toEqual(['b', 'c'])
  })

  it('does nothing for a card that no longer exists', async () => {
    const { result } = await loaded()
    await expect(result.current.moveCard('ghost', 'done', null)).resolves.toBe(false)
  })
})

describe('deleting and restoring a card', () => {
  it('removes it from the screen and the database, and hands it back', async () => {
    const { result } = await loaded()
    let removed: Card | undefined
    act(() => {
      removed = result.current.deleteCard('b')
    })
    expect(removed?.title).toBe('Card b')
    expect(ids(result.current.cards)).toEqual(['a', 'c'])
    await waitFor(() => expect(dbRow('b')).toBeUndefined())
  })

  it('brings a deleted card back in the same place with the same id', async () => {
    const { result } = await loaded()
    let removed: Card | undefined
    act(() => {
      removed = result.current.deleteCard('b')
    })
    await waitFor(() => expect(dbRow('b')).toBeUndefined())

    act(() => result.current.restoreCard(removed!))
    expect(ids(result.current.cards)).toEqual(['a', 'b', 'c'])
    await waitFor(() => expect(dbRow('b')).toMatchObject({ title: 'Card b', position: 2 }))
  })

  it('does not restore a card twice or onto a deleted board', async () => {
    const { result } = await loaded()
    const existing = result.current.cards[0]
    act(() => result.current.restoreCard(existing))
    expect(result.current.cards.filter((c) => c.id === existing.id)).toHaveLength(1)

    act(() => result.current.restoreCard({ ...existing, id: 'zzz', boardId: 'deleted-board' }))
    expect(result.current.cards.find((c) => c.id === 'zzz')).toBeUndefined()
  })

  it('returns nothing when the card is already gone', async () => {
    const { result } = await loaded()
    expect(result.current.deleteCard('ghost')).toBeUndefined()
  })
})

describe('when the server refuses a change', () => {
  it('rolls the screen back to what the server has and explains', async () => {
    const { result } = await loaded()
    db.failNext('cards.insert', { message: 'violates check constraint "cards_title_check"', code: '23514' })
    let created: ReturnType<typeof result.current.saveCard>
    act(() => {
      created = result.current.saveCard(draft({ title: 'Doomed' }))
    })
    expect(result.current.cards.some((c) => c.title === 'Doomed')).toBe(true) // optimistic

    expect(await created!.saved).toBe(false)
    await waitFor(() => expect(result.current.cards.some((c) => c.title === 'Doomed')).toBe(false))
    expect(result.current.actionError).toBe('Some of that information isn’t valid.')
    expect(result.current.actionError).not.toContain('cards_title_check')

    act(() => result.current.dismissActionError())
    expect(result.current.actionError).toBeNull()
  })

  it('puts a card back where it was when a move fails', async () => {
    const { result } = await loaded()
    db.failNext('cards.update')
    let saved: Promise<boolean>
    act(() => {
      saved = result.current.moveCard('a', 'done', null)
    })
    expect(ids(result.current.cards, 'done')).toEqual(['a'])
    expect(await saved!).toBe(false)
    await waitFor(() => expect(ids(result.current.cards)).toEqual(['a', 'b', 'c']))
  })
})

describe('boards', () => {
  it('writes in order, so a card added right after a new board is accepted', async () => {
    const { result } = await loaded()
    let boardId: string | undefined
    act(() => {
      boardId = result.current.addBoard('Side project')
    })
    expect(result.current.activeBoardId).toBe(boardId)
    let created: ReturnType<typeof result.current.saveCard>
    act(() => {
      created = result.current.saveCard(draft({ title: 'First card' }))
    })

    expect(await created!.saved).toBe(true)
    expect(dbRow(created!.id)?.board_id).toBe(boardId)
    const order = db.calls.filter((c) => c.op === 'insert').map((c) => c.table)
    expect(order).toEqual(['boards', 'cards'])
  })

  it('renames a board', async () => {
    const { result } = await loaded()
    act(() => result.current.renameBoard('b2', 'Household'))
    expect(result.current.boards.find((b) => b.id === 'b2')?.name).toBe('Household')
    await waitFor(() => expect(db.boards.find((b) => b.id === 'b2')?.name).toBe('Household'))
  })

  it('deleting a board removes its cards and moves to the neighbouring board', async () => {
    const { result } = await loaded()
    act(() => result.current.selectBoard('b2'))
    act(() => result.current.deleteBoard('b2'))
    expect(result.current.boards.map((b) => b.id)).toEqual(['b1'])
    expect(result.current.activeBoardId).toBe('b1')
    await waitFor(() => expect(db.boards.map((b) => b.id)).toEqual(['b1']))
  })

  it('never deletes the last board', async () => {
    db.reset({ boards: [boardRow(WORK)] })
    const { result } = await loaded()
    act(() => result.current.deleteBoard('b1'))
    expect(result.current.boards).toHaveLength(1)
    expect(db.callsTo('delete', 'boards')).toHaveLength(0)
  })

  it('remembers the last board per user and keeps selectBoard stable', async () => {
    const { result, rerender } = await loaded()
    const selectBoard = result.current.selectBoard
    act(() => result.current.selectBoard('b2'))
    rerender()
    expect(result.current.selectBoard).toBe(selectBoard)
    await waitFor(() => expect(localStorage.getItem('flowboard.active-board.user-1')).toBe('b2'))
  })
})

describe('staying in sync', () => {
  afterEach(() => vi.useRealTimers())

  it('picks up changes made elsewhere when you come back to the tab', async () => {
    const { result } = await loaded()
    db.cards.push(...seedColumn(['elsewhere']))
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 60_000) // past the minimum gap between background re-reads
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(result.current.cards.some((c) => c.id === 'elsewhere')).toBe(true))
  })
})
