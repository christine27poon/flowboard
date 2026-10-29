import { useId, useRef, useState, type FormEvent } from 'react'
import { messageOf } from '../data/api'
import { supabase } from '../data/supabase'

const MIN_PASSWORD_LENGTH = 8

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const uid = useId()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const signingUp = mode === 'signup'

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      // Send people to the first empty field.
      ;(email.trim() ? passwordRef : emailRef).current?.focus()
      return
    }
    if (signingUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password needs at least ${MIN_PASSWORD_LENGTH} characters.`)
      passwordRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      if (signingUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) throw signUpError
        // With "Confirm email" on, there's no session until the emailed link is opened.
        if (!data.session) setNotice('Check your email for a confirmation link, then sign in.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      }
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <form className="auth__card sheet" onSubmit={handleSubmit} noValidate>
        <h1>
          <span aria-hidden="true">🌸</span> Team Board
        </h1>
        <p className="auth__intro">
          Plan work on simple kanban boards. Track due dates and priorities, search your cards, and
          keep everything private to your account.
        </p>
        <h2>{signingUp ? 'Create your account' : 'Welcome back'}</h2>

        <label className="field">
          <span>Email</span>
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${uid}-error` : undefined}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            ref={passwordRef}
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [signingUp ? `${uid}-hint` : '', error ? `${uid}-error` : ''].filter(Boolean).join(' ') ||
              undefined
            }
          />
          {signingUp && (
            <span id={`${uid}-hint`} className="field__hint">
              At least {MIN_PASSWORD_LENGTH} characters.
            </span>
          )}
        </label>

        <label className="auth__show">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          <span>Show password</span>
        </label>

        <div role="alert" id={`${uid}-error`} className="field__error">
          {error}
        </div>
        <div role="status" className="auth__notice">
          {notice}
        </div>

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => switchMode(signingUp ? 'signin' : 'signup')}
        >
          {signingUp ? 'I already have an account' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  )
}
