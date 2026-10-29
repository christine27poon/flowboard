import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../test/fakeSupabase'
import { boardRow, cardRow, makeBoard, makeCard } from '../test/fixtures'
import { renderWithProviders } from '../test/render'
import type { Card } from '../types'
import { useWorkspace } from '../useWorkspace'
import { Board } from './Board'

/** The real board wired to the real state hook and the fake database. */
function Harness() {
  const ws = useWorkspace('user-1')
  if (ws.loading) return null
  return (
    <Board
      cards={ws.cards.filter((c) => c.boardId === 'b1')}
      onSaveCard={ws.saveCard}
      onDeleteCard={ws.deleteCard}
      onRestoreCard={ws.restoreCard}
      onMoveCard={ws.moveCard}
    />
  )
}

const seed = (cards: Partial<Card>[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]) => {
  db.reset({
    boards: [boardRow(makeBoard({ id: 'b1', name: 'Work' }))],
    cards: cards.map((c, i) =>
      cardRow(makeCard({ title: `Card ${c.id}`, boardId: 'b1', position: i + 1, ...c })),
    ),
  })
}

async function renderBoard() {
  const view = renderWithProviders(<Harness />)
  await screen.findByRole('heading', { level: 3, name: 'Backlog' })
  return view
}

/** Card titles in a column, top to bottom. */
const titles = (column: string) => {
  const list = screen.queryByRole('list', { name: column })
  return list ? within(list).getAllByRole('heading', { level: 4 }).map((h) => h.textContent) : []
}
const cardPanel = (title: string) => screen.getByRole('dialog', { name: `Card: ${title}` })
const dbOrder = () =>
  db.cards.slice().sort((x, y) => (x.position as number) - (y.position as number)).map((c) => c.id)

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' })

beforeEach(() => seed())

describe('creating a card', () => {
  it('opens the form in the column whose button was used', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to In Progress' }))

    const dialog = screen.getByRole('dialog', { name: 'New card' })
    expect(within(dialog).getByRole('combobox', { name: 'Column' })).toHaveDisplayValue('In Progress')
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveFocus()
  })

  it('adds the card, highlights it, announces it, and saves it', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to In Progress' }))
    const dialog = screen.getByRole('dialog', { name: 'New card' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Write the docs')
    await user.type(within(dialog).getByRole('textbox', { name: 'Assignee' }), 'Sam')
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(titles('In Progress')).toEqual(['Write the docs'])
    expect(screen.getByRole('heading', { name: 'Write the docs' }).closest('article')).toHaveClass('card--new')
    expect(await screen.findByText('Added “Write the docs” to In Progress.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'New card' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(db.cards.find((c) => c.title === 'Write the docs')).toMatchObject({
        status: 'in-progress',
        assignee: 'Sam',
        board_id: 'b1',
      }),
    )
  })

  it('refuses an empty card and points at the problem', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    const dialog = screen.getByRole('dialog', { name: 'New card' })
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveFocus()
    expect(within(dialog).getByText('Title is required')).toBeInTheDocument()
    expect(db.callsTo('insert', 'cards')).toHaveLength(0)
  })

  it('shows a welcome hint instead of filters on an empty board', async () => {
    seed([])
    await renderBoard()
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('reveals a new card hidden by the current filter', async () => {
    const { user } = await renderBoard()
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'Card a')
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    const dialog = screen.getByRole('dialog', { name: 'New card' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Unrelated')
    await user.type(within(dialog).getByRole('textbox', { name: 'Assignee' }), 'Sam')
    await user.click(within(dialog).getByRole('button', { name: 'Add card' }))

    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('')
    expect(titles('Backlog')).toContain('Unrelated')
  })
})

describe('editing a card', () => {
  it('names the panel after the card and saves changes', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card b' }))

    const panel = cardPanel('Card b')
    const title = within(panel).getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Renamed')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

    expect(await within(panel).findByText('Saved ✓')).toBeInTheDocument()
    expect(db.cards.find((c) => c.id === 'b')?.title).toBe('Renamed')
    expect(titles('Backlog')).toEqual(['Card a', 'Renamed', 'Card c'])
  })

  it('does not claim success when the server refuses', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card b' }))
    const panel = cardPanel('Card b')
    vi.spyOn(console, 'error').mockImplementation(() => {}) // the app logs the refused request in dev
    db.failNext('cards.update')
    await user.type(within(panel).getByRole('textbox', { name: 'Title' }), ' edited')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

    expect(await within(panel).findByText(/That change couldn’t be saved, so it was undone/)).toBeInTheDocument()
    expect(within(panel).queryByText('Saved ✓')).not.toBeInTheDocument()
  })

  it('opens from a click on the card itself and returns focus to the card when closed', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('heading', { name: 'Card a' }))
    const panel = cardPanel('Card a')
    await user.click(within(panel).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Card a' })).toHaveFocus())
  })

  it('closes with Escape and returns focus to the card', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card c' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Card c' })).toHaveFocus())
  })
})

describe('moving a card without dragging', () => {
  it('has Move up and Move down, and says where the card is', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card b' }))
    const panel = cardPanel('Card b')
    expect(within(panel).getByText('Position 2 of 3')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Move up' }))

    expect(titles('Backlog')).toEqual(['Card b', 'Card a', 'Card c'])
    expect(within(panel).getByText('Position 1 of 3')).toBeInTheDocument()
    expect(await within(panel).findByText('Moved up. Position 1 of 3 in Backlog.')).toBeInTheDocument()
    await waitFor(() => expect(dbOrder()).toEqual(['b', 'a', 'c']))
  })

  it('moves down too', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card a' }))
    const panel = cardPanel('Card a')
    await user.click(within(panel).getByRole('button', { name: 'Move down' }))
    expect(titles('Backlog')).toEqual(['Card b', 'Card a', 'Card c'])
    expect(await within(panel).findByText('Moved down. Position 2 of 3 in Backlog.')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Move down' }))
    expect(titles('Backlog')).toEqual(['Card b', 'Card c', 'Card a'])
    await waitFor(() => expect(dbOrder()).toEqual(['b', 'c', 'a']))
  })

  it('keeps the button focusable at the top, says so, and does not move anything', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card a' }))
    const panel = cardPanel('Card a')
    const up = within(panel).getByRole('button', { name: 'Move up' })
    expect(up).toHaveAttribute('aria-disabled', 'true')
    expect(up).not.toBeDisabled()

    up.focus()
    await user.click(up)

    expect(up).toHaveFocus()
    expect(await within(panel).findByText('Already first in this column.')).toBeInTheDocument()
    expect(titles('Backlog')).toEqual(['Card a', 'Card b', 'Card c'])
    expect(db.callsTo('update', 'cards')).toHaveLength(0)
  })

  it('moves a card to another column from the Column field', async () => {
    const { user } = await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Open Card a' }))
    const panel = cardPanel('Card a')
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Column' }), 'done')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))

    await within(panel).findByText('Saved ✓')
    expect(titles('Done')).toEqual(['Card a'])
    expect(db.cards.find((c) => c.id === 'a')?.status).toBe('done')
  })
})

describe('moving a card by dragging', () => {
  it('drops it into another column and announces it', async () => {
    await renderBoard()
    const card = screen.getByRole('heading', { name: 'Card a' }).closest('article')!
    const done = screen.getByRole('region', { name: 'Done' })
    const dt = dataTransfer()

    fireEvent.dragStart(card, { dataTransfer: dt })
    fireEvent.dragOver(done, { dataTransfer: dt })
    fireEvent.drop(done, { dataTransfer: dt })

    expect(titles('Done')).toEqual(['Card a'])
    expect(await screen.findByText('Moved “Card a” to Done.')).toBeInTheDocument()
    await waitFor(() => expect(db.cards.find((c) => c.id === 'a')?.status).toBe('done'))
  })

  it('drops it before the card it lands on', async () => {
    await renderBoard()
    const first = screen.getByRole('heading', { name: 'Card a' }).closest('article')!
    const last = screen.getByRole('heading', { name: 'Card c' }).closest('article')!
    const dt = dataTransfer()

    fireEvent.dragStart(first, { dataTransfer: dt })
    fireEvent.drop(last, { dataTransfer: dt })

    expect(titles('Backlog')).toEqual(['Card b', 'Card a', 'Card c'])
  })

  it('ignores a drop on the card that was picked up', async () => {
    await renderBoard()
    const card = screen.getByRole('heading', { name: 'Card b' }).closest('article')!
    const dt = dataTransfer()
    fireEvent.dragStart(card, { dataTransfer: dt })
    fireEvent.drop(card, { dataTransfer: dt })
    expect(titles('Backlog')).toEqual(['Card a', 'Card b', 'Card c'])
    expect(db.callsTo('update', 'cards')).toHaveLength(0)
  })
})

describe('deleting a card, with undo', () => {
  const deleteCardB = async (user: Awaited<ReturnType<typeof renderBoard>>['user']) => {
    await user.click(screen.getByRole('button', { name: 'Open Card b' }))
    await user.click(within(cardPanel('Card b')).getByRole('button', { name: 'Delete' }))
  }

  it('removes the card at once and offers Undo, with focus already on it', async () => {
    const { user } = await renderBoard()
    await deleteCardB(user)

    expect(titles('Backlog')).toEqual(['Card a', 'Card c'])
    const toast = screen.getByRole('region', { name: 'Notification' })
    expect(toast).toHaveTextContent('Deleted “Card b”.')
    expect(within(toast).getByRole('button', { name: 'Undo' })).toHaveFocus()
    await waitFor(() => expect(db.cards.find((c) => c.id === 'b')).toBeUndefined())
  })

  it('brings the card back where it was, and puts focus on it', async () => {
    const { user } = await renderBoard()
    await deleteCardB(user)
    await waitFor(() => expect(db.cards.find((c) => c.id === 'b')).toBeUndefined())

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(titles('Backlog')).toEqual(['Card a', 'Card b', 'Card c'])
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()
    expect(await screen.findByText('Restored “Card b”.')).toBeInTheDocument()
    await waitFor(() => expect(db.cards.find((c) => c.id === 'b')?.position).toBe(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Card b' })).toHaveFocus())
  })

  it('can be dismissed with Escape or the Dismiss button', async () => {
    const { user } = await renderBoard()
    await deleteCardB(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Card c' }))
    await user.click(within(cardPanel('Card c')).getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()
    expect(titles('Backlog')).toEqual(['Card a'])
  })
})

describe('finding cards', () => {
  it('narrows by search text and says how many are showing', async () => {
    const { user } = await renderBoard()
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'card b')

    expect(titles('Backlog')).toEqual(['Card b'])
    expect(screen.getByText('Showing 1 of 3 cards')).toBeInTheDocument()
    expect(screen.getAllByText('No matching cards')).toHaveLength(3)
  })

  it('also searches descriptions and assignees', async () => {
    seed([{ id: 'a', description: 'needs the quarterly report' }, { id: 'b', assignee: 'Priya' }])
    const { user } = await renderBoard()
    const search = screen.getByRole('searchbox', { name: 'Search cards' })
    await user.type(search, 'quarterly')
    expect(titles('Backlog')).toEqual(['Card a'])
    await user.clear(search)
    await user.type(search, 'priya')
    expect(titles('Backlog')).toEqual(['Card b'])
  })

  it('filters by priority', async () => {
    seed([{ id: 'a', priority: 'High' }, { id: 'b', priority: 'Low' }])
    const { user } = await renderBoard()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'High')
    expect(titles('Backlog')).toEqual(['Card a'])
  })

  it('clears the filters and keeps focus in the search box', async () => {
    const { user } = await renderBoard()
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(titles('Backlog')).toEqual(['Card a', 'Card b', 'Card c'])
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })
})

describe('structure', () => {
  it('has columns as h3 and cards as h4, in lists named after their column', async () => {
    await renderBoard()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Backlog',
      'In Progress',
      'In Review',
      'Done',
    ])
    expect(screen.getByRole('list', { name: 'Backlog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add card to Done' })).toHaveTextContent('Add card')
  })

  it('counts cards in words for screen readers', async () => {
    await renderBoard()
    const header = screen.getByRole('heading', { level: 3, name: 'Backlog' }).closest('header')!
    expect(within(header).getByText('3')).toBeInTheDocument()
    expect(within(header).getByText('cards')).toHaveClass('visually-hidden')
  })
})
