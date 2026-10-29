import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { authState, db, fakeSupabase } from './test/fakeSupabase'
import { boardRow, makeBoard } from './test/fixtures'

beforeEach(() => db.reset({ boards: [boardRow(makeBoard({ id: 'b1', name: 'Work' }))] }))

describe('App', () => {
  it('shows the sign-in screen to someone who is signed out', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('says it is loading while it checks for a session', () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('opens the workspace (loaded on demand) for someone who is signed in', async () => {
    authState.session = { user: { id: 'user-1', email: 'me@example.com' } }
    render(<App />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('returns to sign-in when you sign out', async () => {
    authState.session = { user: { id: 'user-1', email: 'me@example.com' } }
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(fakeSupabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument()
  })
})

describe('App without Supabase settings', () => {
  afterEach(() => {
    vi.doUnmock('./data/supabase')
    vi.resetModules()
  })

  it('explains what to set up instead of failing', async () => {
    vi.resetModules()
    vi.doMock('./data/supabase', () => ({ supabase: fakeSupabase, isSupabaseConfigured: false }))
    const { default: UnconfiguredApp } = await import('./App')
    render(<UnconfiguredApp />)
    expect(screen.getByRole('heading', { level: 1, name: 'Almost there' })).toBeInTheDocument()
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument()
  })
})
