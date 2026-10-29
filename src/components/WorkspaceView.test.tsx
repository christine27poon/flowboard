import type { User } from '@supabase/supabase-js'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, fakeSupabase } from '../test/fakeSupabase'
import { boardRow, cardRow, isoDay, makeBoard, makeCard } from '../test/fixtures'
import { WorkspaceView } from './WorkspaceView'

const me = { id: 'user-1', email: 'me@example.com' } as User
const WORK = makeBoard({ id: 'b1', name: 'Work', position: 1 })
const GARDEN = makeBoard({ id: 'b2', name: 'Garden', position: 2 })

const seed = (extraCards: ReturnType<typeof makeCard>[] = []) =>
  db.reset({
    boards: [boardRow(WORK), boardRow(GARDEN)],
    cards: [
      makeCard({ id: 'a', title: 'Card a', boardId: 'b1', position: 1 }),
      makeCard({ id: 'b', title: 'Card b', boardId: 'b1', position: 2 }),
      ...extraCards,
    ].map(cardRow),
  })

const startAt = (url: string) => window.history.replaceState(null, '', url)

async function open(url = '/') {
  startAt(url)
  const user = userEvent.setup()
  render(<WorkspaceView user={me} />)
  await waitFor(() => expect(screen.queryByText('Loading your boards…')).not.toBeInTheDocument())
  return user
}

const pageHeading = (name: string) => screen.findByRole('heading', { level: 2, name })
const tileLink = (name: string) => within(screen.getByRole('heading', { level: 4, name })).getByRole('link')

beforeEach(() => {
  seed()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Home', () => {
  it('lists every board and sets the page title', async () => {
    await open()
    expect(await pageHeading('Home')).toBeInTheDocument()
    expect(tileLink('Work')).toHaveAttribute('href', '/?board=b1')
    expect(tileLink('Garden')).toHaveAttribute('href', '/?board=b2')
    expect(document.title).toBe('Home · Team Board')
    expect(screen.getByRole('main', { name: 'Home' })).toBeInTheDocument()
  })

  it('offers a skip link that lands on the main area', async () => {
    const user = await open()
    await user.click(screen.getByRole('link', { name: 'Skip to main content' }))
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('marks the current page in the navigation', async () => {
    await open()
    const nav = screen.getByRole('navigation', { name: 'Pages' })
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Design system' })).not.toHaveAttribute('aria-current')
  })
})

describe('moving around', () => {
  it('opens a board from its tile, focuses the new heading, and updates address and title', async () => {
    const user = await open()
    await user.click(tileLink('Work'))

    const heading = await pageHeading('Work')
    await waitFor(() => expect(heading).toHaveFocus())
    expect(window.location.search).toBe('?board=b1')
    expect(document.title).toBe('Work · Team Board')
    expect(screen.getByRole('main', { name: 'Board: Work' })).toBeInTheDocument()
    expect(screen.getByText('2 cards')).toBeInTheDocument()
  })

  it('switches boards from the header and remembers where you were', async () => {
    const user = await open('/?board=b1')
    await pageHeading('Work')
    await user.click(screen.getByRole('button', { name: 'Work, switch board' }))
    await user.click(screen.getByRole('link', { name: /Garden/ }))
    expect(await pageHeading('Garden')).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Home' }))
    await pageHeading('Home')
    const line = screen.getByText(/Continue where you left off/)
    expect(within(line).getByRole('link', { name: 'Garden' })).toBeInTheDocument()
  })

  it('sends a link to a missing board to Home, with a note, and tidies the address', async () => {
    await open('/?board=does-not-exist')
    expect(await pageHeading('Home')).toBeInTheDocument()
    expect(screen.getByText('That board doesn’t exist any more.')).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('opens the card behind a "due soon" link, then drops the card from the address', async () => {
    seed([makeCard({ id: 'late', title: 'Send invoice', boardId: 'b1', dueDate: isoDay(-1), position: 3 })])
    const user = await open()
    const due = screen.getByRole('region', { name: 'Due soon' })
    await user.click(within(due).getByRole('link', { name: 'Send invoice' }))

    expect(await screen.findByRole('dialog', { name: 'Card: Send invoice' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe('?board=b1'))
  })

  it('follows the browser back button', async () => {
    const user = await open()
    await user.click(tileLink('Work'))
    await pageHeading('Work')
    act(() => {
      window.history.back()
    })
    expect(await pageHeading('Home')).toBeInTheDocument()
  })

  it('loads the design-system page on demand', async () => {
    const user = await open()
    await user.click(screen.getByRole('link', { name: 'Design system' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Design system' })).toBeInTheDocument()
    expect(document.title).toBe('Design system · Team Board')
  })
})

describe('a card from start to finish', () => {
  it('can be created, edited, deleted and restored, ending up correct in the database', async () => {
    const user = await open('/?board=b1')
    await pageHeading('Work')

    // create
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    const form = screen.getByRole('dialog', { name: 'New card' })
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Lifecycle')
    await user.type(within(form).getByRole('textbox', { name: 'Assignee' }), 'Sam')
    await user.click(within(form).getByRole('button', { name: 'Add card' }))
    await waitFor(() => expect(db.cards.some((c) => c.title === 'Lifecycle')).toBe(true))

    // edit
    await user.click(screen.getByRole('button', { name: 'Open Lifecycle' }))
    const panel = screen.getByRole('dialog', { name: 'Card: Lifecycle' })
    const title = within(panel).getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Lifecycle v2')
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }))
    await within(panel).findByText('Saved ✓')
    expect(db.cards.find((c) => c.title === 'Lifecycle v2')).toBeDefined()

    // delete, then undo
    await user.click(within(panel).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(db.cards.some((c) => c.title === 'Lifecycle v2')).toBe(false))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(db.cards.find((c) => c.title === 'Lifecycle v2')).toMatchObject({ board_id: 'b1' }))
    expect(screen.getByRole('button', { name: 'Open Lifecycle v2' })).toBeInTheDocument()
  })

  it('shows a clear banner, and rolls back, when a save is refused', async () => {
    const user = await open('/?board=b1')
    await pageHeading('Work')
    db.failNext('cards.insert')
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    const form = screen.getByRole('dialog', { name: 'New card' })
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Refused')
    await user.type(within(form).getByRole('textbox', { name: 'Assignee' }), 'Sam')
    await user.click(within(form).getByRole('button', { name: 'Add card' }))

    const banner = await screen.findByText(/That change couldn’t be saved \(Something went wrong\. Please try again\.\)/)
    expect(banner.closest('[role="alert"]')).not.toBeNull()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Refused' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/couldn’t be saved/)).not.toBeInTheDocument()
  })
})

describe('boards', () => {
  it('creates a board, goes to it and announces it', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: '+ New board' }))
    const dialog = screen.getByRole('dialog', { name: 'New board' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Board name' }), 'Side project')
    await user.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(await pageHeading('Side project')).toBeInTheDocument()
    expect(document.title).toBe('Side project · Team Board')
    expect(await screen.findByText('Created board “Side project”.')).toBeInTheDocument()
    await waitFor(() => expect(db.boards.map((b) => b.name)).toContain('Side project'))
  })

  it('renames a board', async () => {
    const user = await open('/?board=b2')
    await pageHeading('Garden')
    await user.click(screen.getByRole('button', { name: 'Edit board Garden' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit board' })
    const name = within(dialog).getByRole('textbox', { name: 'Board name' })
    await user.clear(name)
    await user.type(name, 'Allotment')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await pageHeading('Allotment')).toBeInTheDocument()
    expect(await screen.findByText('Renamed the board to “Allotment”.')).toBeInTheDocument()
    await waitFor(() => expect(db.boards.find((b) => b.id === 'b2')?.name).toBe('Allotment'))
  })

  it('deletes a board and its cards after confirmation, then returns Home', async () => {
    const user = await open('/?board=b1')
    await pageHeading('Work')
    await user.click(screen.getByRole('button', { name: 'Edit board Work' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit board' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete board' }))
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete board' }))

    expect(await pageHeading('Home')).toBeInTheDocument()
    expect(await screen.findByText('Deleted board “Work”.')).toBeInTheDocument()
    await waitFor(() => expect(db.boards.map((b) => b.id)).toEqual(['b2']))
    expect(db.cards).toHaveLength(0)
  })
})

describe('saved boards from before accounts existed', () => {
  const saveOldWorkspace = () =>
    localStorage.setItem(
      'flowboard.workspace.v1',
      JSON.stringify({
        boards: [{ id: 'old', name: 'Old board' }],
        cards: [{ id: 'oc', boardId: 'old', title: 'Old card', assignee: 'Me', priority: 'Low', status: 'done', dueDate: '2030-01-01' }],
      }),
    )

  it('imports them on request, clears the browser copy, and keeps focus on the page', async () => {
    saveOldWorkspace()
    const user = await open()
    await pageHeading('Home')
    expect(screen.getByText(/We found 1 card on 1 board saved in this browser/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(screen.queryByText(/We found 1 card/)).not.toBeInTheDocument())
    expect(db.boards.map((b) => b.name)).toContain('Old board')
    expect(db.cards.map((c) => c.title)).toContain('Old card')
    expect(localStorage.getItem('flowboard.workspace.v1')).toBeNull()
    expect(localStorage.getItem('flowboard.import-handled.user-1')).not.toBeNull()
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Home' })).toHaveFocus())
  })

  it('leaves them alone when you say no thanks, and does not ask again', async () => {
    saveOldWorkspace()
    const user = await open()
    await pageHeading('Home')
    await user.click(screen.getByRole('button', { name: 'No thanks' }))

    expect(screen.queryByText(/We found 1 card/)).not.toBeInTheDocument()
    expect(db.boards.map((b) => b.name)).not.toContain('Old board')
    expect(localStorage.getItem('flowboard.import-handled.user-1')).not.toBeNull()
  })
})

describe('account and connection', () => {
  it('signs out', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fakeSupabase.auth.signOut).toHaveBeenCalledOnce()
  })

  it('tells you when you are offline, and when you are back', async () => {
    await open()
    await pageHeading('Home')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(await screen.findByText(/You’re offline/)).toBeInTheDocument()

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument())
  })

  it('shows a skeleton, not a blank page, while loading', async () => {
    startAt('/')
    render(<WorkspaceView user={me} />)
    expect(screen.getByText('Loading your boards…')).toBeInTheDocument()
    await pageHeading('Home')
  })

  it('offers a retry when boards cannot be loaded', async () => {
    db.failNext('boards.select')
    startAt('/')
    const user = userEvent.setup()
    render(<WorkspaceView user={me} />)

    expect(await screen.findByText(/Couldn’t load your boards/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await pageHeading('Home')).toBeInTheDocument()
  })
})
