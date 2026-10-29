import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetFakeSupabase } from './fakeSupabase'

// 1. Every test gets the in-memory fake instead of the real Supabase client.
vi.mock('../data/supabase', async () => {
  const { fakeSupabase } = await import('./fakeSupabase')
  return { supabase: fakeSupabase, isSupabaseConfigured: true }
})

// 2. Safety net: anything that still tries to use the network fails loudly.
globalThis.fetch = (() => {
  throw new Error('Network access is blocked in tests')
}) as typeof fetch

beforeEach(() => {
  resetFakeSupabase()
})

if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    document.title = ''
  })

  // jsdom doesn't implement these browser features.
  Element.prototype.scrollIntoView = function scrollIntoView() {}
  // axe probes for canvas support; saying "none" keeps jsdom from printing a notice about it.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList

  /**
   * jsdom has no <dialog>.showModal()/close(). This mimics the parts the app relies on: showModal
   * opens it and focuses its first control; close() hides it, hands focus back to whatever had it,
   * and then (like a browser, a moment later) fires the `close` event; Escape closes the top dialog.
   */
  const openers = new WeakMap<HTMLDialogElement, Element | null>()
  const proto = HTMLDialogElement.prototype
  proto.showModal = function showModal(this: HTMLDialogElement) {
    openers.set(this, document.activeElement)
    this.setAttribute('open', '')
    this.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )?.focus()
  }
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    const opener = openers.get(this)
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    open[open.length - 1]?.close()
  })
}
