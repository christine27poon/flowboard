import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { routeHref, sameRoute, usePage } from './usePage'

describe('routeHref', () => {
  it('builds a real address for every route', () => {
    expect(routeHref({ name: 'home' })).toBe('/')
    expect(routeHref({ name: 'board', boardId: 'b1' })).toBe('/?board=b1')
    expect(routeHref({ name: 'board', boardId: 'b1', cardId: 'c1' })).toBe('/?board=b1&card=c1')
    expect(routeHref({ name: 'design-system' })).toBe('/?page=design-system')
  })

  it('compares routes by address', () => {
    expect(sameRoute({ name: 'home' }, { name: 'home' })).toBe(true)
    expect(sameRoute({ name: 'board', boardId: 'a' }, { name: 'board', boardId: 'b' })).toBe(false)
  })
})

describe('usePage', () => {
  it('reads the starting route from the address', () => {
    window.history.replaceState(null, '', '/?board=b9&card=c3')
    const { result } = renderHook(() => usePage())
    expect(result.current.route).toEqual({ name: 'board', boardId: 'b9', cardId: 'c3' })
  })

  it('defaults to Home, including for unknown pages', () => {
    window.history.replaceState(null, '', '/?page=nope')
    const { result } = renderHook(() => usePage())
    expect(result.current.route).toEqual({ name: 'home' })
  })

  it('pushes history entries when navigating, and replaces on request', () => {
    const { result } = renderHook(() => usePage())
    const before = window.history.length
    act(() => result.current.navigate({ name: 'board', boardId: 'b1' }))
    expect(window.location.search).toBe('?board=b1')
    expect(window.history.length).toBe(before + 1)

    act(() => result.current.navigate({ name: 'home' }, { replace: true }))
    expect(window.location.search).toBe('')
    expect(window.history.length).toBe(before + 1)
  })

  it('follows the back button', () => {
    const { result } = renderHook(() => usePage())
    act(() => result.current.navigate({ name: 'design-system' }))
    window.history.replaceState(null, '', '/?board=zz')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.route).toEqual({ name: 'board', boardId: 'zz', cardId: undefined })
  })
})
