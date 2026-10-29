import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnnounceContext, ToastContext, type Announce, type ToastOptions } from '../feedback'

/* ------------------------------------------------------------------ Announcements */

const CLEAR_AFTER_MS = 8000

/**
 * Provides `useAnnounce` to everything inside it and renders the hidden live regions. A modal
 * dialog makes the rest of the page inert, so each Dialog wraps its content in its own provider:
 * messages sent from inside a dialog are spoken from inside it.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [urgent, setUrgent] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  const announce = useCallback<Announce>((message, options) => {
    const set = options?.urgent ? setUrgent : setPolite
    // Clear first so the same sentence twice in a row is still announced.
    set('')
    timers.current.push(
      window.setTimeout(() => set(message), 50),
      window.setTimeout(() => set(''), CLEAR_AFTER_MS),
    )
  }, [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" role="status">
        {polite}
      </div>
      <div className="visually-hidden" role="alert">
        {urgent}
      </div>
    </AnnounceContext.Provider>
  )
}

/* ------------------------------------------------------------------------- Toast */

const TOAST_MS = 10_000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null)
  const counter = useRef(0)
  const show = useCallback((next: ToastOptions) => {
    counter.current += 1
    setToast({ ...next, id: counter.current })
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}

/**
 * A short message with one action. Focus moves to the action so keyboard and screen-reader users
 * can use it; the timer is paused while it is hovered or focused, and Escape closes it.
 */
function Toast({ toast, onClose }: { toast: ToastOptions; onClose: () => void }) {
  const messageId = useId()
  const box = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    action.current?.focus()
  }, [])

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(close, TOAST_MS)
    return () => window.clearTimeout(timer)
  })

  /** Close, and if focus was inside, hand it back to the page heading instead of losing it. */
  function close() {
    const hadFocus = box.current?.contains(document.activeElement)
    onClose()
    if (hadFocus) {
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#main [data-page-heading]')?.focus(),
      )
    }
  }

  return (
    // A labelled region, so it is a landmark that screen-reader users can jump to.
    <section
      ref={box}
      className="toast"
      aria-label="Notification"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(box.current?.contains(document.activeElement) ?? false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
    >
      <span id={messageId} className="toast__message">
        {toast.message}
      </span>
      <button
        ref={action}
        type="button"
        className="btn btn--small btn--primary"
        aria-describedby={messageId}
        onClick={() => {
          close()
          toast.onAction()
        }}
      >
        {toast.actionLabel}
      </button>
      <button type="button" className="btn btn--small" onClick={close}>
        Dismiss
      </button>
    </section>
  )
}
