import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAnnounce, useToast } from '../feedback'
import { AnnouncerProvider, ToastProvider } from './Feedback'

function Announcer({ message, urgent }: { message: string; urgent?: boolean }) {
  const announce = useAnnounce()
  return <button onClick={() => announce(message, { urgent })}>say</button>
}

describe('announcements', () => {
  it('speaks politely through a status region', async () => {
    const user = userEvent.setup()
    render(<AnnouncerProvider><Announcer message="Card moved" /></AnnouncerProvider>)
    await user.click(screen.getByRole('button', { name: 'say' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Card moved'))
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('interrupts through an alert region when urgent', async () => {
    const user = userEvent.setup()
    render(<AnnouncerProvider><Announcer message="Could not save" urgent /></AnnouncerProvider>)
    await user.click(screen.getByRole('button', { name: 'say' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save'))
  })

  it('announces the same sentence again when repeated', async () => {
    const user = userEvent.setup()
    render(<AnnouncerProvider><Announcer message="Saved" /></AnnouncerProvider>)
    await user.click(screen.getByRole('button', { name: 'say' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    await user.click(screen.getByRole('button', { name: 'say' }))
    // It is cleared first, so assistive technology notices the change.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
  })

  it('clears itself after a while', async () => {
    vi.useFakeTimers()
    render(<AnnouncerProvider><Announcer message="Hello" /></AnnouncerProvider>)
    act(() => screen.getByRole('button', { name: 'say' }).click())
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByRole('status')).toHaveTextContent('Hello')
    act(() => vi.advanceTimersByTime(9000))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

function ShowToast({ onAction }: { onAction: () => void }) {
  const show = useToast()
  useEffect(() => show({ message: 'Deleted “Card”.', actionLabel: 'Undo', onAction }), [show, onAction])
  return null
}

describe('toast', () => {
  afterEach(() => vi.useRealTimers())

  it('puts focus on its action and describes it with the message', () => {
    render(<ToastProvider><ShowToast onAction={vi.fn()} /></ToastProvider>)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()
    expect(undo).toHaveAccessibleDescription('Deleted “Card”.')
  })

  it('runs the action and goes away', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<ToastProvider><ShowToast onAction={onAction} /></ToastProvider>)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ShowToast onAction={vi.fn()} /></ToastProvider>)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()
  })

  it('waits while it has focus, then times out once you move away', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ShowToast onAction={vi.fn()} />
        <button>elsewhere</button>
      </ToastProvider>,
    )
    // Focus is on Undo, so the timer is paused no matter how long it takes.
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('region', { name: 'Notification' })).toBeInTheDocument()

    act(() => screen.getByRole('button', { name: 'elsewhere' }).focus())
    act(() => vi.advanceTimersByTime(10_500))
    expect(screen.queryByRole('region', { name: 'Notification' })).not.toBeInTheDocument()
  })
})
