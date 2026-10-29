import { describe, expect, it } from 'vitest'
import {
  DUE_SOON_DAYS,
  dueSoonCards,
  recentlyUpdatedCards,
  summarizeBoard,
  upcomingCards,
} from './summaries'
import { isoDay, makeBoard, makeCard } from './test/fixtures'

const work = makeBoard({ id: 'work', name: 'Work' })
const home = makeBoard({ id: 'home', name: 'Home' })

describe('summarizeBoard', () => {
  it('counts cards per column and finds the latest change', () => {
    const cards = [
      makeCard({ boardId: 'work', status: 'backlog', updatedAt: '2030-01-01T00:00:00Z' }),
      makeCard({ boardId: 'work', status: 'backlog', updatedAt: '2030-03-01T00:00:00Z' }),
      makeCard({ boardId: 'work', status: 'done', updatedAt: '2030-02-01T00:00:00Z' }),
      makeCard({ boardId: 'home', status: 'in-review' }),
    ]
    const summary = summarizeBoard(work, cards)
    expect(summary.total).toBe(3)
    expect(summary.done).toBe(1)
    expect(summary.counts).toEqual({ backlog: 2, 'in-progress': 0, 'in-review': 0, done: 1 })
    expect(summary.updatedAt).toBe('2030-03-01T00:00:00Z')
  })

  it('handles an empty board', () => {
    const summary = summarizeBoard(work, [])
    expect(summary.total).toBe(0)
    expect(summary.updatedAt).toBeNull()
  })

  it('separates overdue from due-soon and ignores finished cards', () => {
    const cards = [
      makeCard({ boardId: 'work', dueDate: isoDay(-2) }), // overdue
      makeCard({ boardId: 'work', dueDate: isoDay(0) }), // due today: soon, not overdue
      makeCard({ boardId: 'work', dueDate: isoDay(DUE_SOON_DAYS) }), // last day of the window
      makeCard({ boardId: 'work', dueDate: isoDay(DUE_SOON_DAYS + 1) }), // just outside it
      makeCard({ boardId: 'work', dueDate: isoDay(-9), status: 'done' }), // done: never counts
    ]
    const summary = summarizeBoard(work, cards)
    expect(summary.overdue).toBe(1)
    expect(summary.dueSoon).toBe(2)
  })
})

describe('dueSoonCards', () => {
  it('includes overdue and the next 7 days, excludes done and later cards', () => {
    const cards = [
      makeCard({ title: 'late', boardId: 'work', dueDate: isoDay(-1) }),
      makeCard({ title: 'edge', boardId: 'work', dueDate: isoDay(7) }),
      makeCard({ title: 'later', boardId: 'work', dueDate: isoDay(8) }),
      makeCard({ title: 'finished', boardId: 'work', dueDate: isoDay(-5), status: 'done' }),
    ]
    expect(dueSoonCards([work], cards).map((i) => i.card.title)).toEqual(['late', 'edge'])
  })

  it('sorts by urgency, then priority, then title', () => {
    const cards = [
      makeCard({ title: 'B low today', boardId: 'work', dueDate: isoDay(0), priority: 'Low' }),
      makeCard({ title: 'A high today', boardId: 'work', dueDate: isoDay(0), priority: 'High' }),
      makeCard({ title: 'Z overdue', boardId: 'home', dueDate: isoDay(-3), priority: 'Low' }),
      makeCard({ title: 'A low today', boardId: 'work', dueDate: isoDay(0), priority: 'Low' }),
    ]
    expect(dueSoonCards([work, home], cards).map((i) => i.card.title)).toEqual([
      'Z overdue',
      'A high today',
      'A low today',
      'B low today',
    ])
  })

  it('skips cards whose board is unknown', () => {
    expect(dueSoonCards([work], [makeCard({ boardId: 'ghost', dueDate: isoDay(0) })])).toEqual([])
  })
})

describe('recentlyUpdatedCards', () => {
  it('returns the newest changes first and honours the limit', () => {
    const cards = ['2030-01-01', '2030-03-01', '2030-02-01'].map((d, i) =>
      makeCard({ title: `c${i}`, boardId: 'work', updatedAt: `${d}T00:00:00Z` }),
    )
    expect(recentlyUpdatedCards([work], cards, 2).map((i) => i.card.title)).toEqual(['c1', 'c2'])
  })
})

describe('upcomingCards', () => {
  it('lists a board\'s open cards, soonest due first, overdue ones leading', () => {
    const cards = [
      makeCard({ title: 'later', boardId: 'work', dueDate: isoDay(20) }),
      makeCard({ title: 'late', boardId: 'work', dueDate: isoDay(-3) }),
      makeCard({ title: 'soon', boardId: 'work', dueDate: isoDay(2) }),
    ]
    expect(upcomingCards('work', cards).map((c) => c.title)).toEqual(['late', 'soon', 'later'])
  })

  it('shows at most three', () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeCard({ title: `t${i}`, boardId: 'work', dueDate: isoDay(i) }),
    )
    expect(upcomingCards('work', cards).map((c) => c.title)).toEqual(['t0', 't1', 't2'])
  })

  it('skips finished cards and other boards\' cards, even when they are due first', () => {
    const cards = [
      makeCard({ title: 'finished', boardId: 'work', status: 'done', dueDate: isoDay(-5) }),
      makeCard({ title: 'elsewhere', boardId: 'home', dueDate: isoDay(-5) }),
      makeCard({ title: 'open', boardId: 'work', dueDate: isoDay(5) }),
    ]
    expect(upcomingCards('work', cards).map((c) => c.title)).toEqual(['open'])
  })

  it('breaks ties on the same day by priority, then title', () => {
    const day = isoDay(1)
    const cards = [
      makeCard({ title: 'b low', boardId: 'work', dueDate: day, priority: 'Low' }),
      makeCard({ title: 'z high', boardId: 'work', dueDate: day, priority: 'High' }),
      makeCard({ title: 'a high', boardId: 'work', dueDate: day, priority: 'High' }),
    ]
    expect(upcomingCards('work', cards).map((c) => c.title)).toEqual(['a high', 'z high', 'b low'])
  })

  it('is empty for a board with nothing open', () => {
    expect(upcomingCards('work', [])).toEqual([])
  })
})
