import { formatRelative } from '../dates'
import type { BoardSummary } from '../summaries'
import { cardCountLabel } from '../text'
import { STATUSES, STATUS_LABELS } from '../types'
import { RouteLink } from './RouteLink'

/** One board on the Home page: the whole tile is a single link to the board. */
export function BoardTile({ summary }: { summary: BoardSummary }) {
  const { board, total, done, counts, overdue, dueSoon, updatedAt } = summary
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
          <dl className="tile__counts">
            {STATUSES.map((status) => (
              <div key={status}>
                <dt>{STATUS_LABELS[status]}</dt>
                <dd>{counts[status]}</dd>
              </div>
            ))}
          </dl>
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
    </li>
  )
}
