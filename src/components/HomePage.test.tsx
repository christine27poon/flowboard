import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/render'
import { isoDay, makeBoard, makeCard } from '../test/fixtures'
import { HomePage } from './HomePage'

const work = makeBoard({ id: 'work', name: 'Work' })
const hobby = makeBoard({ id: 'hobby', name: 'Hobbies' })

const cards = [
  makeCard({ id: 'late', title: 'Send invoice', boardId: 'work', dueDate: isoDay(-2), priority: 'High', assignee: 'Kim' }),
  makeCard({ id: 'soon', title: 'Plan trip', boardId: 'work', dueDate: isoDay(3), status: 'in-progress' }),
  makeCard({ id: 'done', title: 'Old news', boardId: 'work', dueDate: isoDay(-9), status: 'done' }),
]

const setup = (overrides: Partial<Parameters<typeof HomePage>[0]> = {}) =>
  renderWithProviders(<HomePage boards={[work, hobby]} cards={cards} lastBoard={work} onNewBoard={vi.fn()} onAddTask={vi.fn()} {...overrides} />)

describe('board tiles', () => {
  it('summarise each board in words, not just colour', () => {
    setup()
    const tile = screen.getByRole('heading', { level: 4, name: 'Work' }).closest('li')!
    expect(within(tile).getByText('3 cards')).toBeInTheDocument()
    expect(within(tile).getByText('1 of 3 done')).toBeInTheDocument()
    // The per-column counts are gone; the tile lists tasks instead.
    for (const label of ['Backlog', 'In Progress', 'In Review']) {
      expect(within(tile).queryByText(label)).not.toBeInTheDocument()
    }
    expect(within(tile).getByText('1 overdue')).toBeInTheDocument()
    expect(within(tile).getByText('1 due this week')).toBeInTheDocument()
    expect(within(tile).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/?board=work')
  })

  it('lists the soonest-due open tasks as links, leaving out finished ones', () => {
    setup()
    const tile = screen.getByRole('heading', { level: 4, name: 'Work' }).closest('li')!
    const tasks = within(within(tile).getByRole('list', { name: 'Next tasks on Work' })).getAllByRole('listitem')
    expect(tasks.map((t) => within(t).getByRole('link').textContent)).toEqual(['Send invoice', 'Plan trip'])
    expect(within(tile).getByRole('link', { name: 'Send invoice' })).toHaveAttribute('href', '/?board=work&card=late')
    expect(within(tasks[0]).getByText(/^Overdue, was due/)).toBeInTheDocument()
    expect(within(tasks[1]).getByText(/^Due /)).toBeInTheDocument()
    expect(within(tile).queryByText('Old news')).not.toBeInTheDocument()
  })

  it('shows no more than three tasks per board, the three due first', () => {
    const many = [5, 1, 4, 2, 3].map((d) => makeCard({ title: `Due in ${d}`, boardId: 'work', dueDate: isoDay(d) }))
    setup({ cards: many })
    const tile = screen.getByRole('heading', { level: 4, name: 'Work' }).closest('li')!
    const list = within(tile).getByRole('list', { name: 'Next tasks on Work' })
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['Due in 1', 'Due in 2', 'Due in 3'])
  })

  it('says so when every card on a board is done', () => {
    setup({ cards: [makeCard({ boardId: 'work', status: 'done' })] })
    const tile = screen.getByRole('heading', { level: 4, name: 'Work' }).closest('li')!
    expect(within(tile).getByText('Everything is done')).toBeInTheDocument()
    expect(within(tile).queryByRole('list', { name: /Next tasks/ })).not.toBeInTheDocument()
  })

  it('says so when a board is empty', () => {
    setup()
    const tile = screen.getByRole('heading', { level: 4, name: 'Hobbies' }).closest('li')!
    expect(within(tile).getByText('No cards yet')).toBeInTheDocument()
  })

  it('offers to add a task on every tile, empty boards included', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Add task to Work' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add task to Hobbies' })).toBeInTheDocument()
  })

  it('has a way to start another board', async () => {
    const onNewBoard = vi.fn()
    const { user } = setup({ onNewBoard })
    await user.click(screen.getByRole('button', { name: '+ New board' }))
    expect(onNewBoard).toHaveBeenCalledOnce()
  })
})

describe('adding a task from a tile', () => {
  it('opens the form for that board, without leaving Home', async () => {
    const { user, navigate } = setup()
    await user.click(screen.getByRole('button', { name: 'Add task to Hobbies' }))
    expect(await screen.findByRole('heading', { name: 'New card in Hobbies' })).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('saves the new task to that board and closes the form', async () => {
    const onAddTask = vi.fn()
    const { user } = setup({ onAddTask })
    await user.click(screen.getByRole('button', { name: 'Add task to Hobbies' }))

    const form = await screen.findByRole('dialog', { name: 'New card in Hobbies' })
    await user.type(within(form).getByLabelText(/Title/), 'Buy yarn')
    await user.type(within(form).getByLabelText(/Assignee/), 'Kim')
    await user.click(within(form).getByRole('button', { name: 'Add card' }))

    expect(onAddTask).toHaveBeenCalledOnce()
    expect(onAddTask).toHaveBeenCalledWith(
      'hobby',
      expect.objectContaining({ title: 'Buy yarn', assignee: 'Kim', status: 'backlog' }),
    )
    expect(screen.queryByRole('dialog', { name: /New card/ })).not.toBeInTheDocument()
  })

  it('adds nothing when the form is cancelled', async () => {
    const onAddTask = vi.fn()
    const { user } = setup({ onAddTask })
    await user.click(screen.getByRole('button', { name: 'Add task to Work' }))
    const form = await screen.findByRole('dialog', { name: 'New card in Work' })
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(onAddTask).not.toHaveBeenCalled()
  })
})

describe('due soon', () => {
  it('groups overdue apart from the coming week and leaves finished cards out', () => {
    setup()
    const section = screen.getByRole('region', { name: 'Due soon' })
    expect(within(section).getByRole('heading', { name: 'Overdue' })).toBeInTheDocument()
    expect(within(section).getByRole('heading', { name: 'Next 7 days' })).toBeInTheDocument()
    expect(within(section).getByText(/2 days overdue/)).toBeInTheDocument()
    expect(within(section).queryByText('Old news')).not.toBeInTheDocument()
  })

  it('links each task to its card on its board', () => {
    setup()
    const due = screen.getByRole('region', { name: 'Due soon' })
    expect(within(due).getByRole('link', { name: 'Send invoice' })).toHaveAttribute('href', '/?board=work&card=late')
    expect(within(due).getByRole('link', { name: 'Plan trip' })).toHaveAttribute('href', '/?board=work&card=soon')
  })

  it('reassures when nothing is pressing', () => {
    setup({ cards: [] })
    expect(screen.getByText(/Nothing is overdue or due in the next 7 days/)).toBeInTheDocument()
  })

  it('caps the list and says how many more there are', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeCard({ title: `Task ${i}`, boardId: 'work', dueDate: isoDay(1) }),
    )
    setup({ cards: many })
    expect(screen.getByText('Showing 12 of 15. Open a board to see the rest.')).toBeInTheDocument()
  })
})

describe('around the page', () => {
  it('offers to continue where you left off', () => {
    setup()
    const line = screen.getByText(/Continue where you left off/)
    expect(within(line).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/?board=work')
  })

  it('omits that when there is no previous board', () => {
    setup({ lastBoard: null })
    expect(screen.queryByText(/Continue where you left off/)).not.toBeInTheDocument()
  })

  it('lists the latest changes across boards', () => {
    setup()
    const recent = screen.getByRole('region', { name: 'Recently updated' })
    expect(within(recent).getAllByRole('link')).toHaveLength(3)
  })

  it('has a heading outline that nests: h2 page, h3 sections, h4 tiles', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Home' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Your boards',
      'Due soon',
      'Recently updated',
    ])
    expect(screen.getByRole('heading', { level: 4, name: 'Work' })).toBeInTheDocument()
  })
})
