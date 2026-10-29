import { createContext, useContext } from 'react'

export type Announce = (message: string, options?: { urgent?: boolean }) => void

export const AnnounceContext = createContext<Announce>(() => {})

/** Say something to screen-reader users without moving focus (WCAG 4.1.3 Status Messages). */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext)
}

export interface ToastOptions {
  message: string
  /** Label of the one button, e.g. "Undo". */
  actionLabel: string
  onAction: () => void
}

export const ToastContext = createContext<(toast: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}
