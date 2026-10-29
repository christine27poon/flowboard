// @vitest-environment node
import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { read, root } from './helpers'
import { join } from 'node:path'

/** Every migration, in order, with SQL comments removed. */
const files = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
const strip = (sql: string) => sql.replace(/--.*$/gm, '')
const sql = strip(files.map((f) => read(`supabase/migrations/${f}`)).join('\n'))
const lower = sql.toLowerCase()
const statements = sql.split(';').map((s) => s.trim())

const tables = [...lower.matchAll(/create table public\.(\w+)/g)].map((m) => m[1])
const policies = statements.filter((s) => /^create policy/i.test(s))
const functions = [...sql.matchAll(/create (?:or replace )?function public\.(\w+)[\s\S]*?\$\$/g)]
  .map((m) => ({ name: m[1], start: m.index! }))
  // a function's body runs from its create statement to the closing $$ that follows it
  .map(({ name, start }) => ({ name, text: sql.slice(start, sql.indexOf('$$;', sql.indexOf('$$', start) + 2) + 3) }))

describe('database: every table is protected by row-level security', () => {
  it('finds the app tables', () => {
    expect(tables.sort()).toEqual(['boards', 'cards'])
  })

  it.each(tables)('%s has row-level security switched on', (table) => {
    expect(lower).toContain(`alter table public.${table} enable row level security`)
  })

  it.each(tables)('%s has a policy for each of select, insert, update and delete', (table) => {
    const mine = policies.filter((p) => new RegExp(`on public\\.${table}\\b`, 'i').test(p))
    const commands = mine.map((p) => /for (select|insert|update|delete)/i.exec(p)?.[1].toLowerCase()).sort()
    expect(commands).toEqual(['delete', 'insert', 'select', 'update'])
  })

  it('limits every policy to signed-in users and to their own rows', () => {
    expect(policies.length).toBeGreaterThanOrEqual(8)
    for (const policy of policies) {
      const p = policy.toLowerCase()
      expect(p, policy).toContain('to authenticated')
      expect(p, policy).toContain('auth.uid()')
      expect(p, policy).not.toMatch(/\bto (anon|public)\b/)
      expect(p, policy).not.toMatch(/(using|with check)\s*\(\s*true\s*\)/)
    }
  })

  it('checks the new row as well as the old one on update, so rows cannot be handed away', () => {
    for (const policy of policies.filter((p) => /for update/i.test(p))) {
      expect(policy.toLowerCase()).toMatch(/using \(/)
      expect(policy.toLowerCase()).toMatch(/with check \(/)
    }
  })

  it('only lets a card be created or moved onto a board the user owns', () => {
    const cardWrites = policies.filter((p) => /on public\.cards/i.test(p) && /for (insert|update)/i.test(p))
    expect(cardWrites).toHaveLength(2)
    for (const policy of cardWrites) {
      expect(policy.toLowerCase()).toContain('from public.boards')
      expect(policy.toLowerCase()).toContain('b.user_id')
    }
  })

  it('gives signed-out visitors no access at all', () => {
    expect(lower).toMatch(/revoke all on public\.boards, public\.cards from anon/)
    expect(lower).not.toMatch(/grant [^;]*\bto (anon|public)\b/)
  })
})

describe('database: least privilege', () => {
  it('stops signed-in users running TRUNCATE (which ignores row-level security)', () => {
    expect(lower).toMatch(/revoke truncate, references, trigger on public\.boards, public\.cards from authenticated/)
  })

  it('has no security-definer functions, which would bypass the policies', () => {
    expect(lower).not.toContain('security definer')
  })

  it('makes every function run as the caller with a fixed search path', () => {
    expect(functions.length).toBeGreaterThanOrEqual(5)
    for (const fn of functions) {
      const text = fn.text.toLowerCase().replace(/\s+/g, ' ')
      expect(text, fn.name).not.toContain('security definer')
      expect(text, fn.name).toContain("set search_path = ''")
    }
    // The ones the app can call spell it out.
    for (const name of ['ensure_default_board', 'import_workspace', 'enforce_board_quota', 'enforce_card_quota']) {
      expect(functions.find((f) => f.name === name)?.text.toLowerCase(), name).toContain('security invoker')
    }
  })

  it('keeps every function away from visitors who are not signed in', () => {
    for (const { name } of functions) {
      const revoked = new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from [^;]*\\banon\\b`, 'i')
      expect(sql, name).toMatch(revoked)
    }
  })

  it('does not let signed-in users call the internal trigger functions', () => {
    for (const name of ['set_updated_at', 'enforce_board_quota', 'enforce_card_quota']) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${name}\\(\\) from [^;]*\\bauthenticated\\b`, 'i'))
    }
  })
})

describe('database: limits against abuse', () => {
  it('caps each account at 100 boards and 5,000 cards', () => {
    expect(lower).toContain('>= 100')
    expect(lower).toContain('board limit reached (100 per account)')
    expect(lower).toContain('>= 5000')
    expect(lower).toContain('card limit reached (5000 per account)')
    expect(lower).toMatch(/create trigger boards_enforce_quota before insert on public\.boards/)
    expect(lower).toMatch(/create trigger cards_enforce_quota before insert on public\.cards/)
  })

  it('refuses a malformed or oversized import before doing any work', () => {
    const importer = functions.filter((f) => f.name === 'import_workspace').at(-1)!.text.toLowerCase()
    expect(importer).toContain("jsonb_typeof(payload) is distinct from 'object'")
    expect(importer).toContain('> 100')
    expect(importer).toContain('> 5000')
    expect(importer.indexOf('> 5000')).toBeLessThan(importer.indexOf('pg_advisory_xact_lock'))
  })

  it('keeps field limits as check constraints, not just in the browser', () => {
    expect(lower).toMatch(/char_length\(btrim\(name\)\) between 1 and 30/)
    expect(lower).toMatch(/char_length\(btrim\(title\)\) between 1 and 200/)
    expect(lower).toMatch(/priority in \('high', 'medium', 'low'\)/)
    expect(lower).toMatch(/status in \('backlog', 'in-progress', 'in-review', 'done'\)/)
  })
})

describe('database: policies are explained in plain words', () => {
  it('has a comment on every policy', () => {
    const commented = [...lower.matchAll(/comment on policy "([^"]+)"/g)].map((m) => m[1]).sort()
    const created = policies.map((p) => /create policy "([^"]+)"/i.exec(p)![1].toLowerCase()).sort()
    expect(commented).toEqual(created)
  })
})
