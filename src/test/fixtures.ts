import type { Board, Card } from '../types'

let sequence = 0

/** Local calendar date n days from today as YYYY-MM-DD (the format cards use). */
export function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function makeBoard(overrides: Partial<Board> = {}): Board {
  sequence += 1
  return { id: `board-${sequence}`, name: `Board ${sequence}`, position: sequence, ...overrides }
}

export function makeCard(overrides: Partial<Card> = {}): Card {
  sequence += 1
  const now = new Date().toISOString()
  return {
    id: `card-${sequence}`,
    boardId: 'board-1',
    title: `Card ${sequence}`,
    assignee: 'Alex',
    priority: 'Medium',
    dueDate: isoDay(30),
    status: 'backlog',
    description: '',
    position: sequence,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/** A card as a database row, for seeding the fake Supabase. */
export function cardRow(card: Card): Record<string, unknown> {
  return {
    id: card.id,
    board_id: card.boardId,
    title: card.title,
    assignee: card.assignee,
    priority: card.priority,
    due_date: card.dueDate,
    status: card.status,
    description: card.description,
    position: card.position,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  }
}

export function boardRow(board: Board): Record<string, unknown> {
  return { id: board.id, name: board.name, position: board.position }
}
