import { describe, expect, it } from 'vitest'
import { daysUntil, formatRelative, isOverdue } from './dates'
import { isoDay } from './test/fixtures'

describe('daysUntil', () => {
  const now = new Date(2030, 5, 15, 18, 30) // 15 June 2030, evening

  it('counts whole calendar days, ignoring the time of day', () => {
    expect(daysUntil('2030-06-15', now)).toBe(0)
    expect(daysUntil('2030-06-16', now)).toBe(1)
    expect(daysUntil('2030-06-22', now)).toBe(7)
    expect(daysUntil('2030-06-14', now)).toBe(-1)
  })
})

describe('isOverdue', () => {
  it('is only true for dates before today', () => {
    expect(isOverdue(isoDay(-1))).toBe(true)
    expect(isOverdue(isoDay(0))).toBe(false)
    expect(isOverdue(isoDay(1))).toBe(false)
  })
})

// These assert English wording; CI and the project's dev machines run in an English locale.
describe('formatRelative', () => {
  const now = new Date('2030-06-15T12:00:00Z')
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

  it('says "just now" for the last minute', () => {
    expect(formatRelative(ago(10), now)).toBe('just now')
  })

  it('picks a sensible unit', () => {
    expect(formatRelative(ago(5 * 60), now)).toBe('5 minutes ago')
    expect(formatRelative(ago(2 * 3600), now)).toBe('2 hours ago')
    expect(formatRelative(ago(30 * 3600), now)).toBe('yesterday')
    expect(formatRelative(ago(3 * 86400), now)).toBe('3 days ago')
    expect(formatRelative(ago(40 * 86400), now)).toBe('last month')
  })
})
