import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { routeHref, type Route } from '../usePage'

type Navigate = (route: Route) => void

const NavigateContext = createContext<Navigate | null>(null)
export const NavigateProvider = NavigateContext.Provider

interface RouteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: Route
}

/**
 * A real link (right-click, middle-click and ctrl/cmd-click work), but a plain click changes
 * the route in-app without reloading the page.
 */
export function RouteLink({ to, onClick, ...rest }: RouteLinkProps) {
  const navigate = useContext(NavigateContext)

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    if (rest.target && rest.target !== '_self') return
    if (!navigate) return
    e.preventDefault()
    navigate(to)
  }

  return <a {...rest} href={routeHref(to)} onClick={handleClick} />
}
