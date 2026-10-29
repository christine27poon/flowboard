import type { DragEvent } from 'react'
import { formatDue, isOverdue } from '../dates'
import type { Card as CardType } from '../types'

interface CardProps {
  card: CardType
  isDragging: boolean
  /** Briefly emphasised after the card is created. */
  isNew: boolean
  onOpen: (card: CardType) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDropOnCard: (targetId: string) => void
}

export function Card({
  card,
  isDragging,
  isNew,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropOnCard,
}: CardProps) {
  const overdue = card.status !== 'done' && isOverdue(card.dueDate)

  function handleDragStart(e: DragEvent<HTMLElement>) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.id)
    onDragStart(card.id)
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    onDropOnCard(card.id)
  }

  return (
    // The whole tile opens the panel on click; the "Open" button is the keyboard way in
    // (its click bubbles up to the tile's handler).
    <article
      data-card-id={card.id}
      className={`card${isDragging ? ' card--dragging' : ''}${isNew ? ' card--new' : ''}`}
      draggable
      onClick={() => onOpen(card)}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="card__top">
        <span className={`badge badge--${card.priority.toLowerCase()}`}>{card.priority}</span>
        <button type="button" className="btn btn--ghost" aria-label={`Open ${card.title}`}>
          Open
        </button>
      </div>
      <h4 className="card__title">{card.title}</h4>
      {card.description && <p className="card__desc">{card.description}</p>}
      <dl className="card__meta">
        <div>
          <dt>Assignee</dt>
          <dd>{card.assignee}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd className={overdue ? 'overdue' : undefined}>
            {formatDue(card.dueDate)}
            {overdue && ' (overdue)'}
          </dd>
        </div>
      </dl>
    </article>
  )
}
