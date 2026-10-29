import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeBoard } from '../test/fixtures'
import type { Board } from '../types'
import { BoardModal } from './BoardModal'

const board = makeBoard({ id: 'b1', name: 'Work' })

// Dialogs carry their own (usually empty) live regions, so pick the alert that has the message.
const alertWithText = (text: string) =>
  screen.getAllByRole('alert').find((a) => a.textContent?.includes(text)) ?? null

function setup(props: { target?: Board | 'new'; cardCount?: number; canDelete?: boolean } = {}) {
  const handlers = { onCreate: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  const user = userEvent.setup()
  render(
    <BoardModal
      target={props.target ?? board}
      cardCount={props.cardCount ?? 4}
      canDelete={props.canDelete ?? true}
      {...handlers}
    />,
  )
  return { user, ...handlers }
}

describe('deleting a board', () => {
  it('asks first, names the cost, and puts focus on the safe choice', async () => {
    const { user, onDelete } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete board' }))

    expect(screen.getByText('Delete “Work” and its 4 cards? This can’t be undone.')).toBeInTheDocument()
    expect(alertWithText('Delete “Work”')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('gives focus back to "Delete board" when you change your mind', async () => {
    const { user, onDelete } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete board' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(screen.queryByText(/Delete “Work”/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete board' })).toHaveFocus())
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes once confirmed', async () => {
    const { user, onDelete } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete board' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete board' }))
    expect(onDelete).toHaveBeenCalledWith('b1')
  })

  it('uses the singular for a one-card board', async () => {
    const { user } = setup({ cardCount: 1 })
    await user.click(screen.getByRole('button', { name: 'Delete board' }))
    expect(screen.getByText(/its 1 card\?/)).toBeInTheDocument()
  })

  it('offers no delete when it is the last board', () => {
    setup({ canDelete: false })
    expect(screen.queryByRole('button', { name: 'Delete board' })).not.toBeInTheDocument()
  })
})

describe('naming a board', () => {
  it('focuses the name and announces the problem when it is empty', async () => {
    const { user, onCreate } = setup({ target: 'new' })
    await user.click(screen.getByRole('button', { name: 'Create board' }))

    const name = screen.getByRole('textbox', { name: 'Board name' })
    expect(name).toHaveFocus()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(alertWithText('Board name is required')).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('limits the name to 30 characters and trims it', async () => {
    const { user, onCreate } = setup({ target: 'new' })
    const name = screen.getByRole('textbox', { name: 'Board name' })
    expect(name).toHaveAttribute('maxlength', '30')
    await user.type(name, '  Weekend plans  ')
    await user.click(screen.getByRole('button', { name: 'Create board' }))
    expect(onCreate).toHaveBeenCalledWith('Weekend plans')
  })

  it('renames an existing board', async () => {
    const { user, onRename } = setup()
    const name = screen.getByRole('textbox', { name: 'Board name' })
    await user.clear(name)
    await user.type(name, 'Office')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onRename).toHaveBeenCalledWith('b1', 'Office')
  })

  it('closes with Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
