import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '../test/fakeSupabase'
import { AuthScreen } from './AuthScreen'

const auth = fakeSupabase.auth

function setup() {
  const user = userEvent.setup()
  render(<AuthScreen />)
  const email = screen.getByLabelText('Email')
  const password = screen.getByLabelText('Password')
  const submit = () => user.click(screen.getByRole('button', { name: /Sign in|Create account/ }))
  return { user, email, password, submit }
}

describe('AuthScreen', () => {
  it('says what Team Board is, for people and for crawlers', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: /Team Board/ })).toBeInTheDocument()
    expect(screen.getByText(/Plan work on simple kanban boards/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument()
  })

  it('lets password managers do their job', async () => {
    const { user, email, password } = setup()
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    await user.click(screen.getByRole('button', { name: 'New here? Create an account' }))
    expect(password).toHaveAttribute('autocomplete', 'new-password')
  })

  it('sends focus to the first empty field and ties the error to both fields', async () => {
    const { email, password, submit, user } = setup()
    await submit()
    expect(email).toHaveFocus()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter your email and password.')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email.getAttribute('aria-describedby')).toContain(alert.id)
    expect(password.getAttribute('aria-describedby')).toContain(alert.id)

    await user.type(email, 'me@example.com')
    await submit()
    expect(password).toHaveFocus()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in with the trimmed email', async () => {
    const { user, email, password, submit } = setup()
    await user.type(email, '  me@example.com ')
    await user.type(password, 'hunter2hunter2')
    await submit()
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.com', password: 'hunter2hunter2' })
  })

  it('shows friendly words, never the raw server message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 },
    })
    const { user, email, password, submit } = setup()
    await user.type(email, 'me@example.com')
    await user.type(password, 'wrong-password')
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match.')
    expect(screen.queryByText(/Invalid login credentials/)).not.toBeInTheDocument()
  })

  it('tells you when the server cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, email, password, submit } = setup()
    await user.type(email, 'me@example.com')
    await user.type(password, 'whatever-123')
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Can’t reach the server.')
  })

  it('disables the button while working', async () => {
    let finish!: () => void
    auth.signInWithPassword.mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve({ data: { session: null, user: null }, error: null }))),
    )
    const { user, email, password, submit } = setup()
    await user.type(email, 'me@example.com')
    await user.type(password, 'whatever-123')
    await submit()
    expect(screen.getByRole('button', { name: 'One moment…' })).toBeDisabled()
    finish()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
  })

  it('reveals the password only when asked', async () => {
    const { user, password } = setup()
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('checkbox', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  describe('creating an account', () => {
    it('requires at least 8 characters and focuses the password', async () => {
      const { user, email, password, submit } = setup()
      await user.click(screen.getByRole('button', { name: 'New here? Create an account' }))
      await user.type(email, 'me@example.com')
      await user.type(password, 'short')
      await submit()

      expect(screen.getByRole('alert')).toHaveTextContent('Password needs at least 8 characters.')
      expect(password).toHaveFocus()
      expect(auth.signUp).not.toHaveBeenCalled()
    })

    it('asks you to confirm your email when no session comes back', async () => {
      const { user, email, password, submit } = setup()
      await user.click(screen.getByRole('button', { name: 'New here? Create an account' }))
      await user.type(email, 'me@example.com')
      await user.type(password, 'long-enough-password')
      await submit()

      expect(await screen.findByRole('status')).toHaveTextContent('Check your email for a confirmation link')
      expect(auth.signUp).toHaveBeenCalledOnce()
    })
  })
})
