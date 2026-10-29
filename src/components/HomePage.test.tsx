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
  renderWithProviders(<HomePage boards={[work, hobby]} cards={cards} lastBoard={work} onNewBoard={vi.fn()} {...overrides} />)

describe('board tiles', () => {
  it('summarise each board in words, not just colour', () => {
    setup()
    const tile = screen.getByRole('heading', { level: 4, name: 'Work' }).closest('li')!
    expect(within(tile).getByText('3 cards')).toBeInTheDocument()
    expect(within(tile).getByText('1 of 3 done')).toBeInTheDocument()
    expect(within(tile).getByText('1 overdue')).toBeInTheDocument()
    expect(within(tile).getByText('1 due this week')).toBeInTheDocument()
    expect(within(tile).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/?board=work')
  })

  it('says so when a board is empty', () => {
    setup()
    const tile = screen.getByRole('heading', { level: 4, name: 'Hobbies' }).closest('li')!
    expect(within(tile).getByText('No cards yet')).toBeInTheDocument()
  })

  it('has a way to start another board', async () => {
    const onNewBoard = vi.fn()
    const { user } = setup({ onNewBoard })
    await user.click(screen.getByRole('button', { name: '+ New board' }))
    expect(onNewBoard).toHaveBeenCalledOnce()
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
