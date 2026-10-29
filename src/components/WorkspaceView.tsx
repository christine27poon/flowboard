import type { User } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { supabase } from '../data/supabase'
import {
  hasHandledImport,
  loadLocalWorkspace,
  markImportHandled,
  readActiveBoardId,
} from '../storage'
import { summarizeBoard } from '../summaries'
import type { Board as BoardType } from '../types'
import { sameRoute, usePage, type Route } from '../usePage'
import { useOnlineStatus } from '../useOnlineStatus'
import { useWorkspace } from '../useWorkspace'
import { Board } from './Board'
import { useAnnounce } from '../feedback'
import { AnnouncerProvider, ToastProvider } from './Feedback'
import { BoardHeader } from './BoardHeader'
import { BoardModal } from './BoardModal'
import { BoardSkeleton } from './BoardSkeleton'
import { HomePage } from './HomePage'
import { ImportBanner } from './ImportBanner'
import { NavigateProvider, RouteLink } from './RouteLink'

// Loaded on demand: the docs page is big and most visits never open it.
const DesignSystemPage = lazy(() =>
  import('./design/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })),
)

const NAV_LINKS: { to: Route; label: string }[] = [
  { to: { name: 'home' }, label: 'Home' },
  { to: { name: 'design-system' }, label: 'Design system' },
]

const APP_NAME = 'Team Board'
const MISSING_BOARD_NOTICE = 'That board doesn’t exist any more.'

/** Boards belong to Home in the nav; only the docs are a separate page. */
function isCurrent(link: Route, route: Route): boolean {
  return link.name === 'design-system'
    ? route.name === 'design-system'
    : route.name !== 'design-system'
}

export function WorkspaceView({ user }: { user: User }) {
  return (
    <AnnouncerProvider>
      <ToastProvider>
        <Workspace user={user} />
      </ToastProvider>
    </AnnouncerProvider>
  )
}

function Workspace({ user }: { user: User }) {
  const ws = useWorkspace(user.id)
  const announce = useAnnounce()
  const { route, navigate } = usePage()
  const online = useOnlineStatus()
  const [localData, setLocalData] = useState(() =>
    hasHandledImport(user.id) ? null : loadLocalWorkspace(),
  )
  // null = closed, 'new' = creating, a board = renaming/deleting.
  const [boardDialog, setBoardDialog] = useState<BoardType | 'new' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Read once, before this visit overwrites it, so Home can offer "continue where you left off".
  const [lastBoardId, setLastBoardId] = useState(() => readActiveBoardId(user.id))

  const cardCounts: Record<string, number> = {}
  for (const card of ws.cards) cardCounts[card.boardId] = (cardCounts[card.boardId] ?? 0) + 1

  const ready = !ws.loading && !ws.loadError
  const currentBoard =
    route.name === 'board' ? ws.boards.find((b) => b.id === route.boardId) : undefined
  const currentBoardId = currentBoard?.id
  const lastBoard = ws.boards.find((b) => b.id === lastBoardId) ?? null
  const openCardId = route.name === 'board' ? route.cardId : undefined

  // A link to a board that's gone (deleted, or someone else's) lands on Home with a note.
  const boardMissing = ready && route.name === 'board' && !currentBoardId
  if (boardMissing && notice !== MISSING_BOARD_NOTICE) setNotice(MISSING_BOARD_NOTICE)
  useEffect(() => {
    if (boardMissing) navigate({ name: 'home' }, { replace: true })
  }, [boardMissing, navigate])

  // Remember the board being viewed.
  if (currentBoardId && currentBoardId !== lastBoardId) setLastBoardId(currentBoardId)
  const { selectBoard } = ws
  useEffect(() => {
    if (currentBoardId) selectBoard(currentBoardId)
  }, [currentBoardId, selectBoard])

  // The card in the URL has done its job once the board is showing; keep the address tidy so a
  // refresh doesn't pop the panel open again.
  const boardRouteId = route.name === 'board' ? route.boardId : undefined
  useEffect(() => {
    if (ready && currentBoardId && openCardId) {
      navigate({ name: 'board', boardId: currentBoardId }, { replace: true })
    }
  }, [ready, currentBoardId, openCardId, navigate])

  const pageTitle =
    route.name === 'design-system'
      ? 'Design system'
      : route.name === 'board'
        ? (currentBoard?.name ?? 'Board')
        : 'Home'
  useEffect(() => {
    document.title = `${pageTitle} · ${APP_NAME}`
  }, [pageTitle])

  // After moving to a new view, put focus on its heading so keyboard and screen-reader users
  // start at the new content (the docs page does this itself).
  const routeKey = `${route.name}:${boardRouteId ?? ''}`
  const previousKey = useRef(routeKey)
  useEffect(() => {
    if (previousKey.current === routeKey) return
    previousKey.current = routeKey
    if (!routeKey.startsWith('design-system')) {
      document.querySelector<HTMLElement>('#main [data-page-heading]')?.focus()
    }
  }, [routeKey])

  function dismissImport() {
    markImportHandled(user.id)
    setLocalData(null)
    // The banner's buttons are about to disappear; don't leave focus on nothing.
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#main [data-page-heading]')?.focus(),
    )
  }

  function goTo(next: Route) {
    if (!sameRoute(next, route)) {
      setNotice(null)
      navigate(next)
    }
  }

  const mainLabel =
    route.name === 'board' ? (currentBoard ? `Board: ${currentBoard.name}` : 'Board') : 'Home'

  return (
    <NavigateProvider value={goTo}>
      <div className="board-wrap">
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('main')?.focus()
          }}
        >
          Skip to main content
        </a>

        <header className="topbar">
          <h1>
            <span aria-hidden="true">🌸</span> {APP_NAME}
          </h1>
          <nav aria-label="Pages">
            <ul className="page-tabs">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <RouteLink
                    to={link.to}
                    className="page-tab"
                    aria-current={isCurrent(link.to, route) ? 'page' : undefined}
                  >
                    {link.label}
                  </RouteLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="topbar__user">
            <span className="topbar__email">{user.email}</span>
            <button type="button" className="btn btn--small" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </header>

        {/* The wrapper stays mounted so screen readers announce the note when it appears. */}
        <div role="status">
          {!online && (
            <div className="notice notice--offline">
              <p>You’re offline. Changes won’t be saved until you’re back online.</p>
            </div>
          )}
          {notice && (
            <div className="notice">
              <p>{notice}</p>
              <button type="button" className="btn btn--small" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        {ws.actionError && (
          <div className="notice notice--error" role="alert">
            <p>
              That change couldn’t be saved ({ws.actionError}). Your boards were reloaded from your
              account.
            </p>
            <button type="button" className="btn btn--small" onClick={ws.dismissActionError}>
              Dismiss
            </button>
          </div>
        )}

        {route.name === 'design-system' && (
          <Suspense
            fallback={
              <main id="main" tabIndex={-1}>
                <p className="state" role="status">
                  Loading…
                </p>
              </main>
            }
          >
            <DesignSystemPage />
          </Suspense>
        )}

        {route.name !== 'design-system' && (
          <main id="main" tabIndex={-1} aria-label={mainLabel}>
            {ws.loading && <BoardSkeleton />}

            {ws.loadError && (
              <div className="state" role="alert">
                <p>Couldn’t load your boards: {ws.loadError}</p>
                <button type="button" className="btn btn--primary" onClick={() => void ws.retry()}>
                  Try again
                </button>
              </div>
            )}

            {ready && localData && (
              <ImportBanner local={localData} onImport={ws.importLocal} onDismiss={dismissImport} />
            )}

            {ready && route.name === 'home' && (
              <HomePage
                boards={ws.boards}
                cards={ws.cards}
                lastBoard={lastBoard}
                onNewBoard={() => setBoardDialog('new')}
                onAddTask={(boardId, draft) => ws.saveCard(draft, undefined, boardId)}
              />
            )}

            {ready && currentBoard && (
              <>
                <BoardHeader
                  board={currentBoard}
                  boards={ws.boards}
                  summary={summarizeBoard(currentBoard, ws.cards)}
                  cardCounts={cardCounts}
                  onNewBoard={() => setBoardDialog('new')}
                  onEditBoard={() => setBoardDialog(currentBoard)}
                />

                {/* Keyed so the open panel/modal, any drag state and filters reset when switching boards. */}
                <Board
                  key={currentBoard.id}
                  cards={ws.cards.filter((c) => c.boardId === currentBoard.id)}
                  openCardId={openCardId}
                  onSaveCard={ws.saveCard}
                  onDeleteCard={ws.deleteCard}
                  onRestoreCard={ws.restoreCard}
                  onMoveCard={ws.moveCard}
                />
              </>
            )}
          </main>
        )}

        <BoardModal
          target={boardDialog}
          cardCount={boardDialog && boardDialog !== 'new' ? (cardCounts[boardDialog.id] ?? 0) : 0}
          canDelete={ws.boards.length > 1}
          onCreate={(name) => {
            const id = ws.addBoard(name)
            setBoardDialog(null)
            if (id) {
              navigate({ name: 'board', boardId: id })
              announce(`Created board “${name}”.`)
            }
          }}
          onRename={(id, name) => {
            ws.renameBoard(id, name)
            setBoardDialog(null)
            announce(`Renamed the board to “${name}”.`)
          }}
          onDelete={(id) => {
            const name = ws.boards.find((b) => b.id === id)?.name
            ws.deleteBoard(id)
            setBoardDialog(null)
            navigate({ name: 'home' })
            if (name) announce(`Deleted board “${name}”.`)
          }}
          onClose={() => setBoardDialog(null)}
        />
      </div>
    </NavigateProvider>
  )
}
