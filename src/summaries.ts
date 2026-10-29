import { daysUntil } from './dates'
import { STATUSES, type Board, type Card, type Status } from './types'

/** How far ahead "due soon" looks, in days (today included). */
export const DUE_SOON_DAYS = 7

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const

export interface BoardSummary {
  board: Board
  total: number
  done: number
  counts: Record<Status, number>
  /** Not-done cards whose due date has passed. */
  overdue: number
  /** Not-done cards due today or within the next DUE_SOON_DAYS days (overdue not included). */
  dueSoon: number
  /** Most recent card change, or null for an empty board. */
  updatedAt: string | null
}

export function summarizeBoard(board: Board, allCards: Card[], now: Date = new Date()): BoardSummary {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>
  let overdue = 0
  let dueSoon = 0
  let updatedAt: string | null = null
  const cards = allCards.filter((c) => c.boardId === board.id)

  for (const card of cards) {
    counts[card.status] += 1
    if (updatedAt === null || card.updatedAt > updatedAt) updatedAt = card.updatedAt
    if (card.status === 'done') continue
    const days = daysUntil(card.dueDate, now)
    if (days < 0) overdue += 1
    else if (days <= DUE_SOON_DAYS) dueSoon += 1
  }
  return { board, total: cards.length, done: counts.done, counts, overdue, dueSoon, updatedAt }
}

export interface DueItem {
  card: Card
  board: Board
  /** Negative = days overdue; 0 = today. */
  days: number
}

/** Cards that are overdue or due within DUE_SOON_DAYS, excluding Done. Most urgent first. */
export function dueSoonCards(boards: Board[], cards: Card[], now: Date = new Date()): DueItem[] {
  const boardsById = new Map(boards.map((b) => [b.id, b]))
  const items: DueItem[] = []
  for (const card of cards) {
    const board = boardsById.get(card.boardId)
    if (!board || card.status === 'done') continue
    const days = daysUntil(card.dueDate, now)
    if (days <= DUE_SOON_DAYS) items.push({ card, board, days })
  }
  return items.sort(
    (a, b) =>
      a.days - b.days ||
      PRIORITY_RANK[a.card.priority] - PRIORITY_RANK[b.card.priority] ||
      a.card.title.localeCompare(b.card.title),
  )
}

export interface RecentItem {
  card: Card
  board: Board
}

/** The most recently changed cards across all boards. */
export function recentlyUpdatedCards(boards: Board[], cards: Card[], limit = 8): RecentItem[] {
  const boardsById = new Map(boards.map((b) => [b.id, b]))
  return cards
    .filter((c) => boardsById.has(c.boardId))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit)
    .map((card) => ({ card, board: boardsById.get(card.boardId)! }))
}
