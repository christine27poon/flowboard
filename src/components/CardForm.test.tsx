import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { makeCard } from '../test/fixtures'
import type { Card, CardDraft } from '../types'
import { CardForm } from './CardForm'

const field = (name: string) => screen.getByRole('textbox', { name })

describe('CardForm validation', () => {
  it('explains what is missing, announces it, and sends focus to the first problem', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CardForm card={null} submitLabel="Add card" onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(onSave).not.toHaveBeenCalled()
    const title = field('Title')
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    const alerts = screen.getAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(['Title is required', 'Assignee is required'])
    // The error is tied to its field for screen readers.
    expect(title.getAttribute('aria-describedby')).toBe(alerts[0].id)
  })

  it('moves focus to the next problem as earlier ones are fixed', async () => {
    const user = userEvent.setup()
    render(<CardForm card={null} submitLabel="Add card" onSave={vi.fn()} />)

    await user.type(field('Title'), 'Write tests')
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(field('Assignee')).toHaveFocus()
  })

  it('saves trimmed values once everything is filled in', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CardForm card={null} submitLabel="Add card" defaultStatus="in-review" onSave={onSave} />)

    await user.type(field('Title'), '  Ship it  ')
    await user.type(field('Assignee'), ' Sam ')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'Ship it', assignee: 'Sam', status: 'in-review', priority: 'Medium' })
  })

  it('starts in the column it was opened for', () => {
    render(<CardForm card={null} submitLabel="Add card" defaultStatus="in-progress" onSave={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Column' })).toHaveDisplayValue('In Progress')
  })
})

/** Mimics the app: saving updates the card the form was given. */
function Saving({ result }: { result: () => Promise<boolean> }) {
  const [card, setCard] = useState<Card>(makeCard({ title: 'Original' }))
  return (
    <CardForm
      card={card}
      submitLabel="Save changes"
      requireChanges
      onSave={(draft: CardDraft) => {
        setCard({ ...card, ...draft })
        return result()
      }}
    />
  )
}

describe('CardForm save status', () => {
  const edit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(field('Title'), ' v2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
  }

  it('only says "Saved" once the server has accepted the change', async () => {
    const user = userEvent.setup()
    let accept!: (ok: boolean) => void
    render(<Saving result={() => new Promise<boolean>((resolve) => (accept = resolve))} />)

    await edit(user)
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument()

    accept(true)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved ✓'))
  })

  it('says so, in an alert, when the change was refused', async () => {
    const user = userEvent.setup()
    render(<Saving result={() => Promise.resolve(false)} />)

    await edit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('That change couldn’t be saved, so it was undone.')
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument()
  })

  it('clears "Saved" as soon as the card is edited again', async () => {
    const user = userEvent.setup()
    render(<Saving result={() => Promise.resolve(true)} />)

    await edit(user)
    await screen.findByText('Saved ✓')
    await user.type(field('Title'), '!')
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument()
  })

  it('keeps Save disabled until something changes', async () => {
    const user = userEvent.setup()
    render(<Saving result={() => Promise.resolve(true)} />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await user.type(field('Title'), 'x')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})

describe('CardForm delete', () => {
  it('deletes straight away: undo, not a confirmation, is the safety net', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<CardForm card={makeCard()} submitLabel="Save changes" onSave={vi.fn()} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
