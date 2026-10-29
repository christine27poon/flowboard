import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

// jsdom doesn't lay anything out, so give the dialog a box: x 100–500, y 100–400.
const BOX = { left: 100, right: 500, top: 100, bottom: 400, width: 400, height: 300, x: 100, y: 100 }
const OUTSIDE = { clientX: 20, clientY: 20 }
const INSIDE = { clientX: 300, clientY: 250 }

function setup() {
  const onClose = vi.fn()
  render(
    <Dialog open onClose={onClose} labelledBy="t" className="modal">
      <h2 id="t">Title</h2>
      <input aria-label="Field" />
    </Dialog>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Title' })
  dialog.getBoundingClientRect = () => ({ ...BOX, toJSON: () => BOX })
  return { dialog, onClose }
}

const click = (el: Element, at: { clientX: number; clientY: number }) => {
  fireEvent.mouseDown(el, at)
  fireEvent.mouseUp(el, at)
  fireEvent.click(el, at)
}

describe('clicking outside a dialog', () => {
  it('closes it', async () => {
    const { dialog, onClose } = setup()
    click(dialog, OUTSIDE)
    expect(dialog).not.toHaveAttribute('open')
    // The browser reports a close a moment after it happens.
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('leaves it open when the click is on its content', () => {
    const { dialog, onClose } = setup()
    click(screen.getByLabelText('Field'), INSIDE)
    click(screen.getByRole('heading', { name: 'Title' }), INSIDE)
    expect(dialog).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves it open when the click is on empty space inside it', () => {
    const { dialog, onClose } = setup()
    click(dialog, INSIDE)
    expect(dialog).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves it open when a drag that began inside ends outside', () => {
    const { dialog, onClose } = setup()
    fireEvent.mouseDown(screen.getByLabelText('Field'), INSIDE)
    fireEvent.mouseUp(dialog, OUTSIDE)
    fireEvent.click(dialog, OUTSIDE)
    expect(dialog).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not treat a keyboard-activated click as a click outside', () => {
    const { dialog, onClose } = setup()
    fireEvent.click(dialog, { clientX: 0, clientY: 0 })
    expect(dialog).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
  })
})
