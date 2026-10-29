import { STATUSES } from '../types'

/** Placeholder columns shown while the boards load. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading your boards…
      </p>
      <div className="board" aria-hidden="true">
        {STATUSES.map((status, i) => (
          <div key={status} className={`column column--${status}`}>
            <div className="skeleton skeleton--heading" />
            {Array.from({ length: 2 - (i % 2) }, (_, n) => (
              <div key={n} className="skeleton skeleton--card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
