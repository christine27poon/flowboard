import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'board'; boardId: string; cardId?: string }
  | { name: 'design-system' }

/**
 * The route lives in the URL so every view can be linked to and the back button works:
 * Home is `/`, a board is `?board=<id>` (plus `&card=<id>` to open a card), and the docs are
 * `?page=design-system`.
 */
function readRoute(): Route {
  const params = new URLSearchParams(window.location.search)
  if (params.get('page') === 'design-system') return { name: 'design-system' }
  const boardId = params.get('board')
  if (boardId) return { name: 'board', boardId, cardId: params.get('card') ?? undefined }
  return { name: 'home' }
}

function routeUrl(route: Route): URL {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  if (route.name === 'design-system') url.searchParams.set('page', 'design-system')
  if (route.name === 'board') {
    url.searchParams.set('board', route.boardId)
    if (route.cardId) url.searchParams.set('card', route.cardId)
  }
  return url
}

/** Real URL for a route, for use as a link's href (so it can be opened in a new tab). */
export function routeHref(route: Route): string {
  const url = routeUrl(route)
  return `${url.pathname}${url.search}`
}

export function sameRoute(a: Route, b: Route): boolean {
  return routeHref(a) === routeHref(b)
}

export function usePage() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  /** Go to a route. `replace` swaps the current history entry instead of adding one. */
  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState(null, '', routeUrl(next))
    else window.history.pushState(null, '', routeUrl(next))
    setRoute(next)
  }, [])

  return { route, navigate }
}
