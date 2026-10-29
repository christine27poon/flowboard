import { useState } from 'react'
import { formatDue, formatRelative } from '../dates'
import { useAnnounce } from '../feedback'
import {
  DUE_SOON_DAYS,
  dueSoonCards,
  recentlyUpdatedCards,
  summarizeBoard,
  upcomingCards,
  type DueItem,
} from '../summaries'
import { STATUS_LABELS, type Board, type Card, type CardDraft } from '../types'
import { BoardTile } from './BoardTile'
import { CardModal } from './CardModal'
import { RouteLink } from './RouteLink'

interface HomePageProps {
  boards: Board[]
  cards: Card[]
  /** The board the user was last on, if it still exists. */
  lastBoard: Board | null
  onNewBoard: () => void
  /** Add a card to a board without opening it. */
  onAddTask: (boardId: string, draft: CardDraft) => void
}

/** Most rows shown under "Due soon" before the rest are summarized as a count. */
const MAX_DUE_ROWS = 12

function dueLabel({ days, card }: DueItem): string {
  if (days < 0) {
    const late = -days
    return `Due ${formatDue(card.dueDate)} (${late} ${late === 1 ? 'day' : 'days'} overdue)`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due ${formatDue(card.dueDate)}`
}

export function HomePage({ boards, cards, lastBoard, onNewBoard, onAddTask }: HomePageProps) {
  const announce = useAnnounce()
  // The board a task is being added to, or null when the form is closed.
  const [addingTo, setAddingTo] = useState<Board | null>(null)
  const summaries = boards.map((board) => summarizeBoard(board, cards))
  const due = dueSoonCards(boards, cards)
  const shownDue = due.slice(0, MAX_DUE_ROWS)
  const overdue = shownDue.filter((i) => i.days < 0)
  const upcoming = shownDue.filter((i) => i.days >= 0)
  const recent = recentlyUpdatedCards(boards, cards)

  return (
    <div className="home">
      <header className="home__header">
        <h2 tabIndex={-1} data-page-heading="">
          Home
        </h2>
        {lastBoard && (
          <p>
            Continue where you left off:{' '}
            <RouteLink to={{ name: 'board', boardId: lastBoard.id }}>{lastBoard.name}</RouteLink>
          </p>
        )}
      </header>

      <section aria-labelledby="home-boards">
        <h3 id="home-boards" className="home__heading">
          Your boards
        </h3>
        <ul className="tiles">
          {summaries.map((summary) => (
            <BoardTile
              key={summary.board.id}
              summary={summary}
              tasks={upcomingCards(summary.board.id, cards)}
              onAddTask={setAddingTo}
            />
          ))}
          <li>
            <button type="button" className="tile tile--new" onClick={onNewBoard}>
              + New board
            </button>
          </li>
        </ul>
      </section>

      <CardModal
        open={addingTo !== null}
        status="backlog"
        boardName={addingTo?.name}
        onSave={(draft) => {
          if (!addingTo) return
          onAddTask(addingTo.id, draft)
          announce(`Added “${draft.title}” to ${addingTo.name}.`)
          setAddingTo(null)
        }}
        onClose={() => setAddingTo(null)}
      />

      <section aria-labelledby="home-due">
        <h3 id="home-due" className="home__heading">
          Due soon
        </h3>
        {due.length === 0 ? (
          <p className="home__empty">Nothing is overdue or due in the next {DUE_SOON_DAYS} days.</p>
        ) : (
          <>
            {overdue.length > 0 && <TaskGroup title="Overdue" items={overdue} />}
            {upcoming.length > 0 && <TaskGroup title={`Next ${DUE_SOON_DAYS} days`} items={upcoming} />}
            {due.length > shownDue.length && (
              <p className="home__empty">
                Showing {shownDue.length} of {due.length}. Open a board to see the rest.
              </p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="home-recent">
        <h3 id="home-recent" className="home__heading">
          Recently updated
        </h3>
        {recent.length === 0 ? (
          <p className="home__empty">No cards yet. Open a board and add one to get started.</p>
        ) : (
          <ul className="task-list">
            {recent.map(({ card, board }) => (
              <li key={card.id} className="task">
                <RouteLink
                  to={{ name: 'board', boardId: board.id, cardId: card.id }}
                  className="task__title"
                >
                  {card.title}
                </RouteLink>
                <span className="task__meta">
                  <span>{board.name}</span>
                  <span>{STATUS_LABELS[card.status]}</span>
                  <span>
                    Updated <time dateTime={card.updatedAt}>{formatRelative(card.updatedAt)}</time>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TaskGroup({ title, items }: { title: string; items: DueItem[] }) {
  return (
    <>
      <h4 className="home__subheading">{title}</h4>
      <ul className="task-list">
        {items.map((item) => (
          <li key={item.card.id} className="task">
            <RouteLink
              to={{ name: 'board', boardId: item.board.id, cardId: item.card.id }}
              className="task__title"
            >
              {item.card.title}
            </RouteLink>
            <span className="task__meta">
              <span className={`badge badge--${item.card.priority.toLowerCase()}`}>
                {item.card.priority}
              </span>
              <span className={item.days < 0 ? 'overdue' : undefined}>{dueLabel(item)}</span>
              <span>{item.board.name}</span>
              <span>{item.card.assignee}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
