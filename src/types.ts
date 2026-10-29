export const STATUSES = ['backlog', 'in-progress', 'in-review', 'done'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  done: 'Done',
}

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Board {
  id: string
  name: string
  /** Tab order; larger comes later. */
  position: number
}

export interface Card {
  id: string
  boardId: string
  title: string
  assignee: string
  priority: Priority
  /** ISO date, YYYY-MM-DD */
  dueDate: string
  status: Status
  description: string
  /** Order within its column on the board; the app inserts between neighbours. */
  position: number
  /** ISO timestamps. Kept in sync by the server; the app also sets them on optimistic changes. */
  createdAt: string
  updatedAt: string
}

/** The editable part of a card; id, boardId, position and timestamps are assigned by the app. */
export type CardDraft = Omit<Card, 'id' | 'boardId' | 'position' | 'createdAt' | 'updatedAt'>

/** All boards and cards for the signed-in user, plus which board is showing. */
export interface Workspace {
  boards: Board[]
  activeBoardId: string
  cards: Card[]
}
