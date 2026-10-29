import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { AnnouncerProvider, ToastProvider } from '../components/Feedback'
import { NavigateProvider } from '../components/RouteLink'

/** Render with the app's providers (live-region announcer, toast, in-app navigation). */
export function renderWithProviders(ui: ReactElement) {
  const navigate = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <NavigateProvider value={navigate}>
      <AnnouncerProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AnnouncerProvider>
    </NavigateProvider>,
  )
  return { user, navigate, ...result }
}
