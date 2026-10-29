import { daysUntil, formatDue, formatRelative } from '../dates'
import type { BoardSummary } from '../summaries'
import { cardCountLabel } from '../text'
import type { Board, Card } from '../types'
import { RouteLink } from './RouteLink'

interface BoardTileProps {
  summary: BoardSummary
  /** The board's next tasks to show, soonest due first. */
  tasks: Card[]
  onAddTask: (board: Board) => void
}

/** One board on the Home page: the title links to the board, and its next tasks are listed. */
export function BoardTile({ summary, tasks, onAddTask }: BoardTileProps) {
  const { board, total, done, overdue, dueSoon, updatedAt } = summary
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <li className="tile">
      <h4 className="tile__name">
        <RouteLink to={{ name: 'board', boardId: board.id }} className="tile__link">
          {board.name}
        </RouteLink>
      </h4>
      <p className="tile__total">{cardCountLabel(total)}</p>

      {total > 0 ? (
        <>
          {tasks.length > 0 ? (
            <ul className="tile__tasks" aria-label={`Next tasks on ${board.name}`}>
              {tasks.map((card) => {
                const late = daysUntil(card.dueDate) < 0
                return (
                  <li key={card.id}>
                    <RouteLink
                      to={{ name: 'board', boardId: board.id, cardId: card.id }}
                      className="tile__task"
                    >
                      {card.title}
                    </RouteLink>
                    <span className={late ? 'overdue' : undefined}>
                      {late ? 'Overdue, was due ' : 'Due '}
                      {formatDue(card.dueDate)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="tile__empty">Everything is done</p>
          )}
          <div className="progress" aria-hidden="true">
            <span className="progress__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="tile__progress">
            {done} of {total} done
          </p>
          {(overdue > 0 || dueSoon > 0) && (
            <p className="tile__due">
              {overdue > 0 && <span className="overdue">{overdue} overdue</span>}
              {dueSoon > 0 && <span>{dueSoon} due this week</span>}
            </p>
          )}
          {updatedAt && (
            <p className="tile__updated">
              Updated <time dateTime={updatedAt}>{formatRelative(updatedAt)}</time>
            </p>
          )}
        </>
      ) : (
        <p className="tile__empty">No cards yet</p>
      )}

      <button
        type="button"
        className="btn btn--small tile__add"
        aria-label={`Add task to ${board.name}`}
        onClick={() => onAddTask(board)}
      >
        + Add task
      </button>
    </li>
  )
}
