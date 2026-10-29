import { describe, expect, it } from 'vitest'
import { supabase } from '../data/supabase'
import { fakeSupabase } from './fakeSupabase'

describe('test safety net: no real database', () => {
  it('uses the in-memory fake instead of the real Supabase client', () => {
    expect(supabase).toBe(fakeSupabase)
  })

  it('blocks network access outright', () => {
    expect(() => fetch('https://example.supabase.co/rest/v1/boards')).toThrow(
      'Network access is blocked in tests',
    )
  })

  it('points any stray client at a dummy address, never the real project', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe('http://localhost:54321')
  })
})
