import { useState, type DragEvent } from 'react'
import { cardNoun } from '../text'
import { STATUS_LABELS, type Card as CardType, type Status } from '../types'
import { Card } from './Card'

interface ColumnProps {
  status: Status
  cards: CardType[]
  draggingId: string | null
  /** The id of a just-created card to emphasise. */
  newCardId: string | null
  /** A filter is hiding some cards, so an empty column may not really be empty. */
  filtered: boolean
  onOpen: (card: CardType) => void
  onAdd: (status: Status) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  /** Drop on empty space in the column (append) or onto a card (insert before it). */
  onDrop: (status: Status, beforeId: string | null) => void
}

export function Column({
  status,
  cards,
  draggingId,
  newCardId,
  filtered,
  onOpen,
  onAdd,
  onDragStart,
  onDragEnd,
  onDrop,
}: ColumnProps) {
  const [isOver, setIsOver] = useState(false)
  const headingId = `col-${status}`

  function handleDragOver(e: DragEvent<HTMLElement>) {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsOver(true)
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    setIsOver(false)
    onDrop(status, null)
  }

  return (
    <section
      className={`column column--${status}${isOver ? ' column--over' : ''}`}
      aria-labelledby={headingId}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false)
      }}
      onDrop={handleDrop}
    >
      <header className="column__header">
        <h3 id={headingId}>{STATUS_LABELS[status]}</h3>
        <span className="column__count">
          {cards.length}{' '}
          <span className="visually-hidden">{cardNoun(cards.length)}</span>
        </span>
        <button type="button" className="btn btn--primary btn--small" onClick={() => onAdd(status)}>
          <span aria-hidden="true">+ </span>Add card{' '}
          <span className="visually-hidden">to {STATUS_LABELS[status]}</span>
        </button>
      </header>
      <div className="column__cards">
        {cards.length === 0 && (
          <p className="column__empty">{filtered ? 'No matching cards' : 'No cards'}</p>
        )}
        {cards.length > 0 && (
          <ul className="column__list" aria-labelledby={headingId}>
            {cards.map((card) => (
              <li key={card.id}>
                <Card
                  card={card}
                  isDragging={draggingId === card.id}
                  isNew={newCardId === card.id}
                  onOpen={onOpen}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDropOnCard={(targetId) => {
                    setIsOver(false)
                    onDrop(status, targetId)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
