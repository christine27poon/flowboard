import type { BoardSummary } from '../summaries'
import { cardCountLabel } from '../text'
import type { Board } from '../types'
import { BoardSwitcher } from './BoardSwitcher'
import { RouteLink } from './RouteLink'

interface BoardHeaderProps {
  board: Board
  boards: Board[]
  summary: BoardSummary
  cardCounts: Record<string, number>
  onNewBoard: () => void
  onEditBoard: () => void
}

/** Title block of a board: where you are, a way to switch, and what's on it. */
export function BoardHeader({
  board,
  boards,
  summary,
  cardCounts,
  onNewBoard,
  onEditBoard,
}: BoardHeaderProps) {
  return (
    <header className="board-header">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li>
            <RouteLink to={{ name: 'home' }} className="breadcrumb__link">
              Home
            </RouteLink>
          </li>
          <li className="breadcrumb__sep" aria-hidden="true">
            ›
          </li>
          <li>
            <BoardSwitcher
              boards={boards}
              currentId={board.id}
              cardCounts={cardCounts}
              onNewBoard={onNewBoard}
            />
          </li>
        </ol>
      </nav>

      <div className="board-header__main">
        <div className="board-header__title">
          <h2 tabIndex={-1} data-page-heading="">
            {board.name}
          </h2>
          <p className="board-header__stats">
            <span>{cardCountLabel(summary.total)}</span>
            {summary.dueSoon > 0 && <span>{summary.dueSoon} due this week</span>}
            {summary.overdue > 0 && <span className="overdue">{summary.overdue} overdue</span>}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--small"
          onClick={onEditBoard}
          aria-label={`Edit board ${board.name}`}
        >
          Edit board
        </button>
      </div>
    </header>
  )
}
