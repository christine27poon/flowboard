import { useEffect, useRef, useState } from 'react'
import { cardCountLabel } from '../text'
import {
  PRIORITIES,
  STATUSES,
  STATUS_LABELS,
  type Card,
  type CardDraft,
  type Priority,
  type Status,
} from '../types'
import { CardModal } from './CardModal'
import { CardPanel } from './CardPanel'
import { Column } from './Column'
import { useAnnounce, useToast } from '../feedback'

interface BoardProps {
  /** Cards of the active board only, in column order. */
  cards: Card[]
  /** Open this card's panel when the board first shows (from a link on Home). */
  openCardId?: string
  /** Returns the saved card's id and whether the server accepted it (undefined if nothing was saved). */
  onSaveCard: (
    draft: CardDraft,
    id?: string,
  ) => { id: string; saved: Promise<boolean> } | undefined
  /** Returns the removed card so it can be brought back. */
  onDeleteCard: (id: string) => Card | undefined
  onRestoreCard: (card: Card) => void
  onMoveCard: (id: string, status: Status, beforeId: string | null) => Promise<boolean>
}

/** How long a newly added card stays emphasised. */
const NEW_CARD_HIGHLIGHT_MS = 3000

/** Put keyboard focus back on a card's "Open" button once it is on screen again. */
function focusCard(id: string) {
  window.requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-card-id="${id}"] button`)?.focus(),
  )
}

export function Board({
  cards,
  openCardId,
  onSaveCard,
  onDeleteCard,
  onRestoreCard,
  onMoveCard,
}: BoardProps) {
  const announce = useAnnounce()
  const showToast = useToast()

  // The column a new card is being added to, or null when the "new card" form is closed.
  const [newCardStatus, setNewCardStatus] = useState<Status | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(openCardId ?? null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [newCardId, setNewCardId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = cards.find((c) => c.id === selectedId) ?? null
  const selectedColumn = selected ? cards.filter((c) => c.status === selected.status) : []
  const selectedIndex = selected ? selectedColumn.findIndex((c) => c.id === selected.id) : -1

  const needle = query.trim().toLowerCase()
  const filterActive = needle !== '' || priority !== 'all'
  function matchesFilter(card: CardDraft): boolean {
    if (priority !== 'all' && card.priority !== priority) return false
    if (!needle) return true
    return [card.title, card.description, card.assignee].some((text) =>
      text.toLowerCase().includes(needle),
    )
  }
  const visibleCards = filterActive ? cards.filter(matchesFilter) : cards

  function clearFilters() {
    setQuery('')
    setPriority('all')
  }

  // Bring a just-added card into view (it may be below the fold), then let the emphasis fade.
  useEffect(() => {
    if (!newCardId) return
    document
      .querySelector(`[data-card-id="${newCardId}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const timer = window.setTimeout(() => setNewCardId(null), NEW_CARD_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [newCardId])

  function handleNewCard(draft: CardDraft) {
    const result = onSaveCard(draft)
    setNewCardStatus(null)
    if (!result) return
    // A filter that hides the new card would make it look like nothing happened.
    if (filterActive && !matchesFilter(draft)) clearFilters()
    setNewCardId(result.id)
    announce(`Added “${draft.title}” to ${STATUS_LABELS[draft.status]}.`)
  }

  function handleDrop(status: Status, beforeId: string | null) {
    const id = draggingId
    setDraggingId(null)
    if (!id || id === beforeId) return
    const card = cards.find((c) => c.id === id)
    void onMoveCard(id, status, beforeId)
    if (card) announce(`Moved “${card.title}” to ${STATUS_LABELS[status]}.`)
  }

  /** The keyboard (and pointer-without-dragging) way to reorder a card within its column. */
  function moveWithinColumn(id: string, direction: 'up' | 'down'): Promise<boolean> {
    const card = cards.find((c) => c.id === id)
    if (!card) return Promise.resolve(false)
    const column = cards.filter((c) => c.status === card.status)
    const index = column.findIndex((c) => c.id === id)
    if (direction === 'up' && index <= 0) return Promise.resolve(true)
    if (direction === 'down' && index >= column.length - 1) return Promise.resolve(true)
    const beforeId = direction === 'up' ? column[index - 1].id : (column[index + 2]?.id ?? null)
    return onMoveCard(id, card.status, beforeId)
  }

  function closePanel() {
    const id = selectedId
    setSelectedId(null)
    // Opened with the mouse, the browser has nowhere sensible to return focus to; go to the card.
    if (id) focusCard(id)
  }

  function handleDelete(id: string) {
    const removed = onDeleteCard(id)
    setSelectedId(null)
    if (!removed) return
    showToast({
      message: `Deleted “${removed.title}”.`,
      actionLabel: 'Undo',
      onAction: () => {
        onRestoreCard(removed)
        announce(`Restored “${removed.title}”.`)
        focusCard(removed.id)
      },
    })
  }

  return (
    <>
      {cards.length === 0 ? (
        <p className="board__hint">
          Nothing here yet. Use “Add card” in any column to get started. Drag a card to move it, or
          open it to edit it, change its column or reorder it.
        </p>
      ) : (
        <div className="filters" role="search" aria-label="Filter cards">
          <label className="field filters__query">
            <span>Search cards</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, description or assignee"
            />
          </label>
          <label className="field filters__priority">
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')}>
              <option value="all">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {filterActive && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                clearFilters()
                // The button disappears; keep focus somewhere sensible.
                searchRef.current?.focus()
              }}
            >
              Clear filters
            </button>
          )}
          <p className="filters__count" role="status">
            {filterActive ? `Showing ${visibleCards.length} of ${cardCountLabel(cards.length)}` : ''}
          </p>
        </div>
      )}

      <div className="board">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            cards={visibleCards.filter((c) => c.status === status)}
            draggingId={draggingId}
            newCardId={newCardId}
            filtered={filterActive}
            onOpen={(card) => setSelectedId(card.id)}
            onAdd={setNewCardStatus}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
          />
        ))}
      </div>

      <CardModal
        open={newCardStatus !== null}
        status={newCardStatus ?? 'backlog'}
        onSave={handleNewCard}
        onClose={() => setNewCardStatus(null)}
      />

      <CardPanel
        card={selected}
        order={
          selected
            ? { index: selectedIndex, total: selectedColumn.length, column: STATUS_LABELS[selected.status] }
            : null
        }
        onSave={(draft, id) => onSaveCard(draft, id)?.saved}
        onMove={moveWithinColumn}
        onDelete={handleDelete}
        onClose={closePanel}
      />
    </>
  )
}
