import { describe, expect, it } from 'vitest'
import {
  clearLocalWorkspace,
  hasHandledImport,
  loadLocalWorkspace,
  markImportHandled,
  readActiveBoardId,
  writeActiveBoardId,
} from './storage'

const card = (id: string, boardId: string) => ({
  id,
  boardId,
  title: `Card ${id}`,
  assignee: 'Alex',
  priority: 'High',
  status: 'backlog',
  dueDate: '2030-01-01',
})

function saveWorkspace(boards: { id: string; name: string }[], cards: ReturnType<typeof card>[]) {
  localStorage.setItem('flowboard.workspace.v1', JSON.stringify({ boards, cards }))
}

describe('loadLocalWorkspace', () => {
  it('reads the pre-account workspace and stamps cards with the import time', () => {
    saveWorkspace([{ id: 'b1', name: 'Work' }], [card('c1', 'b1')])
    const workspace = loadLocalWorkspace()
    expect(workspace?.boards).toHaveLength(1)
    expect(workspace?.cards[0].title).toBe('Card c1')
    expect(workspace?.cards[0].createdAt).toBeTruthy()
    expect(workspace?.cards[0].updatedAt).toBeTruthy()
  })

  it('returns null when there is nothing worth importing', () => {
    expect(loadLocalWorkspace()).toBeNull()
    saveWorkspace([{ id: 'b1', name: 'Work' }], [])
    expect(loadLocalWorkspace()).toBeNull()
  })

  it('survives corrupt data', () => {
    localStorage.setItem('flowboard.workspace.v1', '{not json')
    expect(loadLocalWorkspace()).toBeNull()
  })

  it('drops cards that are malformed or point at a missing board', () => {
    saveWorkspace([{ id: 'b1', name: 'Work' }], [card('ok', 'b1'), card('orphan', 'ghost')])
    expect(loadLocalWorkspace()?.cards.map((c) => c.id)).toEqual(['ok'])
  })

  // The database refuses more than this; trimming first means one oversized import can't fail whole.
  it('trims to the account limits (100 boards, 5,000 cards)', () => {
    const boards = Array.from({ length: 150 }, (_, i) => ({ id: `b${i}`, name: `B${i}` }))
    const cards = Array.from({ length: 5200 }, (_, i) => card(`c${i}`, 'b0'))
    saveWorkspace(boards, cards)
    const workspace = loadLocalWorkspace()
    expect(workspace?.boards).toHaveLength(100)
    expect(workspace?.cards).toHaveLength(5000)
  })
})

describe('clearLocalWorkspace', () => {
  it('removes both the current and the older saved formats', () => {
    saveWorkspace([{ id: 'b1', name: 'Work' }], [card('c1', 'b1')])
    localStorage.setItem('flowboard.cards.v1', '[]')
    clearLocalWorkspace()
    expect(localStorage.getItem('flowboard.workspace.v1')).toBeNull()
    expect(localStorage.getItem('flowboard.cards.v1')).toBeNull()
    expect(loadLocalWorkspace()).toBeNull()
  })
})

describe('per-user flags', () => {
  it('remembers the import decision and active board for each user separately', () => {
    markImportHandled('u1')
    writeActiveBoardId('u1', 'b1')
    expect(hasHandledImport('u1')).toBe(true)
    expect(hasHandledImport('u2')).toBe(false)
    expect(readActiveBoardId('u1')).toBe('b1')
    expect(readActiveBoardId('u2')).toBeNull()
  })
})
