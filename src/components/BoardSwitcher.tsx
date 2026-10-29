import { useEffect, useId, useRef, useState } from 'react'
import { cardCountLabel } from '../text'
import type { Board } from '../types'
import { RouteLink } from './RouteLink'

interface BoardSwitcherProps {
  boards: Board[]
  currentId: string
  cardCounts: Record<string, number>
  onNewBoard: () => void
}

/**
 * Dropdown for jumping between boards. A disclosure (button + list of links), not an ARIA menu:
 * the items are ordinary links, so Tab, Enter and open-in-new-tab all behave as people expect.
 */
export function BoardSwitcher({ boards, currentId, cardCounts, onNewBoard }: BoardSwitcherProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const current = boards.find((b) => b.id === currentId)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    function onFocusIn(e: FocusEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  return (
    <div className="switcher" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="switcher__button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${current?.name ?? 'Board'}, switch board`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current?.name ?? 'Board'}</span>
        <span aria-hidden="true" className="switcher__chevron">▾</span>
      </button>
      {open && (
        <div className="switcher__popover" id={listId}>
          <ul className="switcher__list">
            {boards.map((board) => (
              <li key={board.id}>
                <RouteLink
                  to={{ name: 'board', boardId: board.id }}
                  className="switcher__item"
                  aria-current={board.id === currentId ? 'page' : undefined}
                  onClick={() => {
                    setOpen(false)
                    // If this is the board already open nothing navigates, so don't strand focus.
                    if (board.id === currentId) buttonRef.current?.focus()
                  }}
                >
                  <span className="switcher__name">{board.name}</span>
                  <span className="switcher__count">{cardCountLabel(cardCounts[board.id] ?? 0)}</span>
                </RouteLink>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="switcher__new"
            onClick={() => {
              setOpen(false)
              // The dialog hands focus back to whatever had it, so make that the switcher.
              buttonRef.current?.focus()
              onNewBoard()
            }}
          >
            + New board
          </button>
        </div>
      )}
    </div>
  )
}
