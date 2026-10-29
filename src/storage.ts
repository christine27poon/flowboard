import { PRIORITIES, STATUSES, type Board, type Card, type Workspace } from './types'

/** Boards + cards from the localStorage-only version of the app (read once, to import). */
const LOCAL_WORKSPACE_KEY = 'flowboard.workspace.v1'
/** Even older single-board format. */
const LEGACY_CARDS_KEY = 'flowboard.cards.v1'

/** Same ceilings the database enforces, so an oversized import is trimmed before it is sent. */
const MAX_BOARDS = 100
const MAX_CARDS = 5000

const importHandledKey = (userId: string) => `flowboard.import-handled.${userId}`
const activeBoardKey = (userId: string) => `flowboard.active-board.${userId}`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}

function parseBoard(value: unknown): Board | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return { id: value.id, name: value.name, position: 0 }
}

function parseCard(value: unknown, fallbackBoardId?: string): Card | null {
  if (!isRecord(value)) return null
  const importedAt = new Date().toISOString()
  const boardId = typeof value.boardId === 'string' ? value.boardId : fallbackBoardId
  if (
    typeof value.id !== 'string' ||
    boardId === undefined ||
    typeof value.title !== 'string' ||
    typeof value.assignee !== 'string' ||
    typeof value.dueDate !== 'string' ||
    !PRIORITIES.includes(value.priority as Card['priority']) ||
    !STATUSES.includes(value.status as Card['status'])
  ) {
    return null
  }
  return {
    id: value.id,
    boardId,
    title: value.title,
    assignee: value.assignee,
    dueDate: value.dueDate,
    priority: value.priority as Card['priority'],
    status: value.status as Card['status'],
    description: typeof value.description === 'string' ? value.description : '',
    position: 0,
    createdAt: importedAt,
    updatedAt: importedAt,
  }
}

function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || !Array.isArray(value.boards) || !Array.isArray(value.cards)) return null
  const boards = value.boards.map(parseBoard).filter(isDefined)
  if (boards.length === 0) return null
  const ids = new Set(boards.map((b) => b.id))
  const cards = value.cards
    .map((c) => parseCard(c))
    .filter(isDefined)
    .filter((c) => ids.has(c.boardId))
  return { boards, activeBoardId: boards[0].id, cards }
}

function parseLegacy(value: unknown): Workspace | null {
  if (!Array.isArray(value)) return null
  const id = 'legacy-board'
  const cards = value.map((c) => parseCard(c, id)).filter(isDefined)
  return { boards: [{ id, name: 'My Board', position: 0 }], activeBoardId: id, cards }
}

/** Data saved by the pre-account version of the app, or null if there is nothing worth importing. */
export function loadLocalWorkspace(): Workspace | null {
  try {
    const current = localStorage.getItem(LOCAL_WORKSPACE_KEY)
    const legacy = localStorage.getItem(LEGACY_CARDS_KEY)
    const workspace =
      (current && parseWorkspace(JSON.parse(current))) || (legacy && parseLegacy(JSON.parse(legacy)))
    if (!workspace) return null
    const boards = workspace.boards.slice(0, MAX_BOARDS)
    const ids = new Set(boards.map((b) => b.id))
    const cards = workspace.cards.filter((c) => ids.has(c.boardId)).slice(0, MAX_CARDS)
    return cards.length > 0 ? { ...workspace, boards, cards } : null
  } catch {
    return null
  }
}

/** Delete the pre-account copy from this browser once it is safely in the account. */
export function clearLocalWorkspace(): void {
  try {
    localStorage.removeItem(LOCAL_WORKSPACE_KEY)
    localStorage.removeItem(LEGACY_CARDS_KEY)
  } catch {
    // Ignore: storage may be unavailable.
  }
}

export function hasHandledImport(userId: string): boolean {
  try {
    return localStorage.getItem(importHandledKey(userId)) !== null
  } catch {
    return false
  }
}

/** Remember that the import was offered and accepted or declined, so it isn't offered again. */
export function markImportHandled(userId: string): void {
  try {
    localStorage.setItem(importHandledKey(userId), '1')
  } catch {
    // Ignore: worst case the offer shows again.
  }
}

export function readActiveBoardId(userId: string): string | null {
  try {
    return localStorage.getItem(activeBoardKey(userId))
  } catch {
    return null
  }
}

export function writeActiveBoardId(userId: string, boardId: string): void {
  try {
    localStorage.setItem(activeBoardKey(userId), boardId)
  } catch {
    // Ignore: the first board shows next time.
  }
}
