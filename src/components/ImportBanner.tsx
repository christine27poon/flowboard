import { useState } from 'react'
import { messageOf } from '../data/api'
import type { Workspace } from '../types'

interface ImportBannerProps {
  local: Workspace
  onImport: (local: Workspace) => Promise<void>
  onDismiss: () => void
}

/** One-time offer to copy boards saved in this browser (pre-account) into the account. */
export function ImportBanner({ local, onImport, onDismiss }: ImportBannerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cards = local.cards.length
  const boards = local.boards.length

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      await onImport(local)
      onDismiss()
    } catch (e) {
      setError(messageOf(e))
      setBusy(false)
    }
  }

  return (
    <section className="notice" aria-label="Import saved boards">
      <p>
        We found {cards === 1 ? '1 card' : `${cards} cards`} on{' '}
        {boards === 1 ? '1 board' : `${boards} boards`} saved in this browser. Add{' '}
        {cards === 1 ? 'it' : 'them'} to your account?
      </p>
      <div className="notice__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={handleImport} disabled={busy}>
          {busy ? 'Importing…' : 'Import'}
        </button>
        <button type="button" className="btn btn--small" onClick={onDismiss} disabled={busy}>
          No thanks
        </button>
      </div>
      <div role="alert" className="field__error">
        {error}
      </div>
    </section>
  )
}
