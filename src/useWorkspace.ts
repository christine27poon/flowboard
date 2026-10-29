import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './data/api'
import { newId } from './id'
import { clearLocalWorkspace, readActiveBoardId, writeActiveBoardId } from './storage'
import type { Card, CardDraft, Status, Workspace } from './types'

const byPosition = (a: Card, b: Card) => a.position - b.position

/** Don't re-read from the server on tab focus more often than this. */
const FOCUS_SYNC_INTERVAL_MS = 15_000

function pickActiveBoard(boards: Workspace['boards'], preferred: string | null): string {
  return boards.find((b) => b.id === preferred)?.id ?? boards[0].id
}

/** Position that puts a card at the end of a column. */
function endPosition(cards: Card[], boardId: string, status: Status): number {
  const column = cards.filter((c) => c.boardId === boardId && c.status === status)
  return column.length ? Math.max(...column.map((c) => c.position)) + 1 : 1
}

/** Below this gap between neighbours, halving again would soon exhaust floating-point precision. */
const MIN_GAP = 1e-6

/**
 * Where a card goes when placed before `beforeId` in a column (or at the end when null).
 * Normally that is a position between its neighbours. When repeated inserts have squeezed the
 * neighbours too close together, the whole column is renumbered 1..n instead and `renumbered`
 * holds the new positions of the *other* cards that need rewriting.
 */
function placeBefore(
  cards: Card[],
  boardId: string,
  status: Status,
  movingId: string,
  beforeId: string | null,
): { position: number; renumbered: Map<string, number> } {
  const column = cards
    .filter((c) => c.boardId === boardId && c.status === status && c.id !== movingId)
    .sort(byPosition)
  const found = beforeId ? column.findIndex((c) => c.id === beforeId) : -1
  const at = found === -1 ? column.length : found
  const renumbered = new Map<string, number>()

  if (at === column.length) {
    return { position: column.length ? column[column.length - 1].position + 1 : 1, renumbered }
  }
  const next = column[at].position
  if (at === 0) return { position: next - 1, renumbered }

  const prev = column[at - 1].position
  if (next - prev >= MIN_GAP) return { position: (prev + next) / 2, renumbered }

  column.forEach((c, i) => {
    const position = i < at ? i + 1 : i + 2
    if (position !== c.position) renumbered.set(c.id, position)
  })
  return { position: at + 1, renumbered }
}

/**
 * The signed-in user's boards and cards, loaded from Supabase. Changes show up immediately
 * (optimistic) and are written in order in the background; if a write fails the data is
 * reloaded from the server and `actionError` explains what happened.
 */
export function useWorkspace(userId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const writes = useRef<Promise<void>>(Promise.resolve())
  // Writes still on their way to the server, and a counter that changes whenever one is queued.
  // A background re-read is only trusted if neither changed while it was in flight.
  const pendingWrites = useRef(0)
  const writeVersion = useRef(0)
  const lastSyncedAt = useRef(0)

  const applyData = useCallback(
    ({ boards, cards }: { boards: Workspace['boards']; cards: Card[] }) => {
      setWorkspace((prev) => ({
        boards,
        cards,
        activeBoardId: pickActiveBoard(boards, prev?.activeBoardId ?? readActiveBoardId(userId)),
      }))
    },
    [userId],
  )

  /** Re-read everything from the server (after a failed write, a retry, or an import). */
  const refresh = useCallback(async () => {
    try {
      applyData(await api.fetchWorkspaceData())
    } catch (error) {
      setLoadError(api.messageOf(error))
    }
  }, [applyData])

  /**
   * Pick up changes made elsewhere (another tab or device). Silent: it never shows an error and
   * never overwrites local edits that haven't reached the server yet.
   */
  const syncQuietly = useCallback(async () => {
    if (pendingWrites.current > 0) return
    const version = writeVersion.current
    try {
      const data = await api.fetchWorkspaceData()
      lastSyncedAt.current = Date.now()
      if (version === writeVersion.current && pendingWrites.current === 0) applyData(data)
    } catch {
      // Keep showing what we have; the next focus or reconnect tries again.
    }
  }, [applyData])

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastSyncedAt.current > FOCUS_SYNC_INTERVAL_MS
      ) {
        void syncQuietly()
      }
    }
    const onOnline = () => void syncQuietly()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [syncQuietly])

  useEffect(() => {
    let cancelled = false
    api.fetchWorkspaceData().then(
      (data) => {
        if (cancelled) return
        lastSyncedAt.current = Date.now()
        applyData(data)
      },
      (error) => {
        if (!cancelled) setLoadError(api.messageOf(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [applyData])

  const activeBoardId = workspace?.activeBoardId
  useEffect(() => {
    if (activeBoardId) writeActiveBoardId(userId, activeBoardId)
  }, [userId, activeBoardId])

  /**
   * Run a write after all earlier ones (a card insert must not overtake its board insert).
   * The returned promise never rejects: it resolves true once the server has the change, or false
   * after the failure has been reported and the data reloaded.
   */
  function enqueue(write: () => Promise<void>): Promise<boolean> {
    pendingWrites.current += 1
    writeVersion.current += 1
    const result = writes.current.then(write).then(
      () => true,
      async (error) => {
        setActionError(api.messageOf(error))
        await refresh()
        return false
      },
    )
    writes.current = result.then(() => {
      pendingWrites.current -= 1
    })
    return result
  }

  function update(change: (prev: Workspace) => Workspace) {
    setWorkspace((prev) => (prev ? change(prev) : prev))
  }

  /** Remember which board was opened last (shown as "Continue where you left off" on Home). */
  const selectBoard = useCallback((id: string) => {
    setWorkspace((prev) => (prev && prev.activeBoardId !== id ? { ...prev, activeBoardId: id } : prev))
  }, [])

  /** Creates a board and makes it the active one. Returns its id. */
  function addBoard(name: string): string | undefined {
    if (!workspace) return undefined
    const board = {
      id: newId(),
      name,
      position: Math.max(0, ...workspace.boards.map((b) => b.position)) + 1,
    }
    update((prev) => ({ ...prev, boards: [...prev.boards, board], activeBoardId: board.id }))
    void enqueue(() => api.insertBoard(board))
    return board.id
  }

  function renameBoard(id: string, name: string) {
    update((prev) => ({
      ...prev,
      boards: prev.boards.map((b) => (b.id === id ? { ...b, name } : b)),
    }))
    void enqueue(() => api.updateBoardName(id, name))
  }

  /** Removes the board and its cards. The last remaining board can't be deleted. */
  function deleteBoard(id: string) {
    if (!workspace || workspace.boards.length <= 1) return
    update((prev) => {
      const index = prev.boards.findIndex((b) => b.id === id)
      const boards = prev.boards.filter((b) => b.id !== id)
      const activeBoardId =
        prev.activeBoardId === id ? boards[Math.max(0, index - 1)].id : prev.activeBoardId
      return { boards, activeBoardId, cards: prev.cards.filter((c) => c.boardId !== id) }
    })
    void enqueue(() => api.deleteBoardById(id))
  }

  /**
   * Update the card with `id`, or add a new one to the active board. Returns the card's id and a
   * promise for whether the server accepted the change (the screen updates straight away).
   */
  function saveCard(
    draft: CardDraft,
    id?: string,
  ): { id: string; saved: Promise<boolean> } | undefined {
    if (!workspace) return undefined
    const existing = id ? workspace.cards.find((c) => c.id === id) : undefined
    if (id && !existing) return undefined

    const now = new Date().toISOString()
    let card: Card
    if (existing) {
      // Changing the column in the panel sends the card to the end of the new column.
      const position =
        draft.status === existing.status
          ? existing.position
          : endPosition(workspace.cards, existing.boardId, draft.status)
      card = { ...existing, ...draft, position, updatedAt: now }
    } else {
      card = {
        ...draft,
        id: newId(),
        boardId: workspace.activeBoardId,
        position: endPosition(workspace.cards, workspace.activeBoardId, draft.status),
        createdAt: now,
        updatedAt: now,
      }
    }

    update((prev) => ({
      ...prev,
      cards: (existing
        ? prev.cards.map((c) => (c.id === card.id ? card : c))
        : [...prev.cards, card]
      ).sort(byPosition),
    }))
    const saved = enqueue(() => (existing ? api.updateCardById(card) : api.insertCard(card)))
    return { id: card.id, saved }
  }

  /** Remove a card. Returns it so the caller can offer to bring it back. */
  function deleteCard(id: string): Card | undefined {
    const removed = workspace?.cards.find((c) => c.id === id)
    if (!removed) return undefined
    update((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }))
    void enqueue(() => api.deleteCardById(id))
    return removed
  }

  /** Put back a card removed with deleteCard (same id, column and place). */
  function restoreCard(card: Card) {
    update((prev) => {
      if (prev.cards.some((c) => c.id === card.id)) return prev
      if (!prev.boards.some((b) => b.id === card.boardId)) return prev
      return { ...prev, cards: [...prev.cards, card].sort(byPosition) }
    })
    void enqueue(() => api.insertCard(card))
  }

  /** Move a card into `status`, before `beforeId` (or to the end of the column when null). */
  function moveCard(id: string, status: Status, beforeId: string | null): Promise<boolean> {
    const moving = workspace?.cards.find((c) => c.id === id)
    if (!workspace || !moving) return Promise.resolve(false)
    const { position, renumbered } = placeBefore(workspace.cards, moving.boardId, status, id, beforeId)
    const now = new Date().toISOString()
    update((prev) => ({
      ...prev,
      cards: prev.cards
        .map((c) => {
          if (c.id === id) return { ...c, status, position, updatedAt: now }
          const shifted = renumbered.get(c.id)
          return shifted === undefined ? c : { ...c, position: shifted }
        })
        .sort(byPosition),
    }))
    return enqueue(async () => {
      for (const [otherId, otherPosition] of renumbered) {
        await api.placeCard(otherId, status, otherPosition)
      }
      await api.placeCard(id, status, position)
    })
  }

  /** Copy a localStorage workspace into the account, then reload. Throws if the import fails. */
  async function importLocal(local: Workspace) {
    await writes.current
    await api.importWorkspace(local)
    // It's in the account now; don't leave a second copy lying around in this browser.
    clearLocalWorkspace()
    await refresh()
  }

  return {
    boards: workspace?.boards ?? [],
    cards: workspace?.cards ?? [],
    activeBoardId: workspace?.activeBoardId ?? '',
    loading: workspace === null && loadError === null,
    loadError,
    retry: () => {
      setLoadError(null)
      return refresh()
    },
    actionError,
    dismissActionError: () => setActionError(null),
    selectBoard,
    addBoard,
    renameBoard,
    deleteBoard,
    saveCard,
    deleteCard,
    restoreCard,
    moveCard,
    importLocal,
  }
}
