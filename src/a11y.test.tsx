import { render, screen, within } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './components/AuthScreen'
import { Board } from './components/Board'
import { BoardHeader } from './components/BoardHeader'
import { BoardModal } from './components/BoardModal'
import { CardModal } from './components/CardModal'
import { AnnouncerProvider, ToastProvider } from './components/Feedback'
import { useToast } from './feedback'
import { HomePage } from './components/HomePage'
import { NavigateProvider, RouteLink } from './components/RouteLink'
import { summarizeBoard } from './summaries'
import { axeViolations } from './test/axe'
import { isoDay, makeBoard, makeCard } from './test/fixtures'

const boards = [makeBoard({ id: 'b1', name: 'Work' }), makeBoard({ id: 'b2', name: 'Garden' })]
const cards = [
  makeCard({ id: 'c1', title: 'Send invoice', boardId: 'b1', priority: 'High', dueDate: isoDay(-2), description: 'Before Friday' }),
  makeCard({ id: 'c2', title: 'Plan trip', boardId: 'b1', status: 'in-progress', dueDate: isoDay(3), position: 1 }),
  makeCard({ id: 'c3', title: 'Water plants', boardId: 'b2', status: 'done' }),
]
const noop = () => {}

/** The app shell around a screen, so landmark rules judge it the way they would in the app. */
function Shell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <NavigateProvider value={noop}>
      <AnnouncerProvider>
        <ToastProvider>
          <a className="skip-link" href="#main">Skip to main content</a>
          <header>
            <h1>Team Board</h1>
            <nav aria-label="Pages">
              <ul>
                <li><RouteLink to={{ name: 'home' }} aria-current="page">Home</RouteLink></li>
                <li><RouteLink to={{ name: 'design-system' }}>Design system</RouteLink></li>
              </ul>
            </nav>
          </header>
          <main id="main" aria-label={label}>{children}</main>
        </ToastProvider>
      </AnnouncerProvider>
    </NavigateProvider>
  )
}

const boardProps = {
  onSaveCard: () => undefined,
  onDeleteCard: () => undefined,
  onRestoreCard: noop,
  onMoveCard: () => Promise.resolve(true),
}
const boardCards = cards.filter((c) => c.boardId === 'b1')

const BoardScreen = ({ openCardId }: { openCardId?: string }) => (
  <Shell label="Board: Work">
    <BoardHeader
      board={boards[0]}
      boards={boards}
      summary={summarizeBoard(boards[0], cards)}
      cardCounts={{ b1: 2, b2: 1 }}
      onNewBoard={noop}
      onEditBoard={noop}
    />
    <Board cards={boardCards} openCardId={openCardId} {...boardProps} />
  </Shell>
)

// Every Level A/AA rule axe can check without a rendered layout; contrast is checked
// separately from the stylesheet (tests/css.test.ts).
describe('automated WCAG 2.2 A/AA scan finds nothing on', () => {
  it('the sign-in screen', async () => {
    render(<AuthScreen />)
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('Home', async () => {
    render(<Shell label="Home"><HomePage boards={boards} cards={cards} lastBoard={boards[0]} onNewBoard={noop} /></Shell>)
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('an empty Home', async () => {
    render(<Shell label="Home"><HomePage boards={boards} cards={[]} lastBoard={null} onNewBoard={noop} /></Shell>)
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('a board', async () => {
    render(<BoardScreen />)
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('a board with the card panel open', async () => {
    render(<BoardScreen openCardId="c1" />)
    expect(screen.getByRole('dialog', { name: 'Card: Send invoice' })).toBeInTheDocument()
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('the new-card form, including its error state', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<Shell label="Board: Work"><CardModal open status="backlog" onSave={noop} onClose={noop} /></Shell>)
    expect(await axeViolations(document.body)).toEqual([])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add card' }))
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('the board dialog, including the delete confirmation', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(
      <Shell label="Board: Work">
        <BoardModal target={boards[0]} cardCount={2} canDelete onCreate={noop} onRename={noop} onDelete={noop} onClose={noop} />
      </Shell>,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete board' }))
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('an Undo message', async () => {
    function ShowToast() {
      const show = useToast()
      useEffect(() => show({ message: 'Deleted “Send invoice”.', actionLabel: 'Undo', onAction: vi.fn() }), [show])
      return null
    }
    render(<Shell label="Board: Work"><ShowToast /></Shell>)
    expect(screen.getByRole('region', { name: 'Notification' })).toBeInTheDocument()
    expect(await axeViolations(document.body)).toEqual([])
  })
})

describe('screen-reader structure', () => {
  it('nests headings: app h1, board h2, columns h3, cards h4', () => {
    render(<BoardScreen />)
    const outline = screen.getAllByRole('heading').map((h) => `h${h.tagName[1]}:${h.textContent}`)
    expect(outline.slice(0, 5)).toEqual(['h1:Team Board', 'h2:Work', 'h3:Backlog', 'h4:Send invoice', 'h3:In Progress'])
    for (const heading of screen.getAllByRole('heading')) {
      expect(['H1', 'H2', 'H3', 'H4']).toContain(heading.tagName)
    }
  })

  it('names the card panel after its card', () => {
    render(<BoardScreen openCardId="c1" />)
    expect(screen.getByRole('dialog', { name: 'Card: Send invoice' })).toBeInTheDocument()
  })

  // A modal makes the rest of the page inert, so announcements must come from inside it.
  it('puts live regions inside the open dialog', () => {
    render(<BoardScreen openCardId="c1" />)
    const dialog = screen.getByRole('dialog', { name: 'Card: Send invoice' })
    expect(dialog.querySelector('[role="status"]')).not.toBeNull()
    expect(dialog.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('keeps each control’s visible text inside its accessible name (WCAG 2.5.3)', () => {
    render(<BoardScreen />)
    expect(screen.getByRole('button', { name: 'Add card to Backlog' })).toHaveTextContent('Add card')
    expect(screen.getByRole('button', { name: 'Edit board Work' })).toHaveTextContent('Edit board')
    expect(screen.getByRole('button', { name: 'Work, switch board' })).toHaveTextContent('Work')
    expect(screen.getByRole('button', { name: 'Open Send invoice' })).toHaveTextContent('Open')
  })

  it('marks overdue in words, not only colour', () => {
    render(<BoardScreen />)
    const card = screen.getByRole('heading', { name: 'Send invoice' }).closest('article')!
    expect(within(card).getByText(/\(overdue\)/)).toBeInTheDocument()
    expect(within(card).getByText('High')).toBeInTheDocument()
  })
})
