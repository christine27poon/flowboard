import { useEffect, useRef, type ReactNode } from 'react'
import { AnnouncerProvider } from './Feedback'

interface DialogProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  className: string
  children: ReactNode
}

/** Native <dialog> modal. Children mount only while open, so forms reset each time. */
export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={className} aria-labelledby={labelledBy} onClose={onClose}>
      {/* A modal makes the rest of the page inert, so announcements need a live region in here. */}
      {open && <AnnouncerProvider>{children}</AnnouncerProvider>}
    </dialog>
  )
}
