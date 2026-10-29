import { useState } from 'react'
import type { Card, CardDraft } from '../types'
import { CardForm } from './CardForm'
import { Dialog } from './Dialog'
import { useAnnounce } from '../feedback'

interface CardPanelProps {
  card: Card | null
  /** Where the card sits in its column (zero-based), for the Move buttons. */
  order: { index: number; total: number; column: string } | null
  onSave: (draft: CardDraft, id: string) => void | Promise<boolean>
  onMove: (id: string, direction: 'up' | 'down') => Promise<boolean>
  onDelete: (id: string) => void
  onClose: () => void
}

/** Side panel with every card field, including the description. */
export function CardPanel({ card, order, onSave, onMove, onDelete, onClose }: CardPanelProps) {
  return (
    <Dialog open={card !== null} onClose={onClose} labelledBy="card-panel-title" className="panel">
      {card && (
        <>
          <header className="panel__header">
            <h2 id="card-panel-title">Card: {card.title}</h2>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </header>
          <div className="sheet">
            {order && <MoveControls card={card} order={order} onMove={onMove} />}
            <CardForm
              key={card.id}
              card={card}
              submitLabel="Save changes"
              requireChanges
              onSave={(draft) => onSave(draft, card.id)}
              onDelete={() => onDelete(card.id)}
            />
          </div>
        </>
      )}
    </Dialog>
  )
}

/**
 * Reorder a card without dragging (WCAG 2.5.7). Lives inside the dialog so that what it announces
 * is spoken from within the modal. The buttons use aria-disabled, not disabled, so focus is never
 * lost when the card reaches the top or bottom.
 */
function MoveControls({
  card,
  order,
  onMove,
}: {
  card: Card
  order: NonNullable<CardPanelProps['order']>
  onMove: CardPanelProps['onMove']
}) {
  const announce = useAnnounce()
  const [failed, setFailed] = useState(false)
  const atTop = order.index === 0
  const atBottom = order.index === order.total - 1

  async function move(direction: 'up' | 'down') {
    if ((direction === 'up' && atTop) || (direction === 'down' && atBottom)) {
      announce(direction === 'up' ? 'Already first in this column.' : 'Already last in this column.')
      return
    }
    setFailed(false)
    // order.index is zero-based, so the new one-based position is index (up) or index + 2 (down).
    const position = direction === 'up' ? order.index : order.index + 2
    announce(`Moved ${direction}. Position ${position} of ${order.total} in ${order.column}.`)
    const ok = await onMove(card.id, direction)
    if (!ok) {
      setFailed(true)
      announce('Couldn’t move the card, so it was put back.', { urgent: true })
    }
  }

  return (
    <fieldset className="move">
      <legend>Order in {order.column}</legend>
      <p className="move__position">
        Position {order.index + 1} of {order.total}
      </p>
      <div className="move__buttons">
        <button
          type="button"
          className="btn btn--small"
          aria-disabled={atTop}
          onClick={() => void move('up')}
        >
          Move up
        </button>
        <button
          type="button"
          className="btn btn--small"
          aria-disabled={atBottom}
          onClick={() => void move('down')}
        >
          Move down
        </button>
      </div>
      {failed && (
        <p className="field__error" role="alert">
          Couldn’t move the card, so it was put back.
        </p>
      )}
    </fieldset>
  )
}
