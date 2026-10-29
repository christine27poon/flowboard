import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { AnnouncerProvider } from './Feedback'

interface DialogProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  className: string
  children: ReactNode
}

/**
 * Whether a mouse event landed on the dimmed area around the dialog. The ::backdrop reports the
 * <dialog> itself as the target, but so does any empty space inside it (a tall side panel with
 * little in it), so the position is checked against the dialog's own box.
 */
function onBackdrop(e: MouseEvent<HTMLDialogElement>): boolean {
  if (e.target !== e.currentTarget) return false
  const box = e.currentTarget.getBoundingClientRect()
  return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom
}

/**
 * Native <dialog> modal. Children mount only while open, so forms reset each time. Clicking the
 * dimmed area outside closes it, the same as Escape or a Close button (unsaved edits are dropped).
 */
export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // A click only counts if it also began outside, so dragging to select text in a field and
  // letting go over the backdrop doesn't close the dialog.
  const pressedOnBackdrop = useRef(false)

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
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = onBackdrop(e)
      }}
      onClick={(e) => {
        const startedOutside = pressedOnBackdrop.current
        pressedOnBackdrop.current = false
        if (startedOutside && onBackdrop(e)) e.currentTarget.close()
      }}
    >
      {/* A modal makes the rest of the page inert, so announcements need a live region in here. */}
      {open && <AnnouncerProvider>{children}</AnnouncerProvider>}
    </dialog>
  )
}
