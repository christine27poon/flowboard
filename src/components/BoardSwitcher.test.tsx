import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/render'
import { makeBoard } from '../test/fixtures'
import { BoardSwitcher } from './BoardSwitcher'

const boards = [makeBoard({ id: 'b1', name: 'Work' }), makeBoard({ id: 'b2', name: 'Home' })]

function setup() {
  const onNewBoard = vi.fn()
  const view = renderWithProviders(
    <>
      <BoardSwitcher boards={boards} currentId="b1" cardCounts={{ b1: 4, b2: 1 }} onNewBoard={onNewBoard} />
      <button type="button">Elsewhere</button>
    </>,
  )
  const trigger = screen.getByRole('button', { name: 'Work, switch board' })
  return { ...view, onNewBoard, trigger }
}

describe('BoardSwitcher', () => {
  it('is a disclosure button that names the current board', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists boards as real links with their card counts, marking the current one', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const work = screen.getByRole('link', { name: /Work/ })
    expect(work).toHaveAttribute('href', '/?board=b1')
    expect(work).toHaveAttribute('aria-current', 'page')
    expect(work).toHaveTextContent('4 cards')
    const home = screen.getByRole('link', { name: /Home/ })
    expect(home).toHaveAttribute('href', '/?board=b2')
    expect(home).not.toHaveAttribute('aria-current')
    expect(home).toHaveTextContent('1 card')
  })

  it('closes on Escape and returns focus to the button', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('link', { name: /Home/ })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('navigates in the app when another board is chosen', async () => {
    const { user, trigger, navigate } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('link', { name: /Home/ }))

    expect(navigate).toHaveBeenCalledWith({ name: 'board', boardId: 'b2' })
    expect(screen.queryByRole('link', { name: /Home/ })).not.toBeInTheDocument()
  })

  it('keeps focus on the button when the board you are already on is chosen', async () => {
    const { user, trigger, navigate } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('link', { name: /Work/ }))

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(navigate).toHaveBeenCalledOnce() // RouteLink still reports it; WorkspaceView ignores same-route
  })

  it('opens the new-board dialog with focus parked on the button, so the dialog can give it back', async () => {
    const { user, trigger, onNewBoard } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: '+ New board' }))

    expect(onNewBoard).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('button', { name: '+ New board' })).not.toBeInTheDocument()
  })

  it('closes when you click elsewhere, without stealing focus', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.click(document.body)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveFocus()
  })

  it('closes when keyboard focus leaves it', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
