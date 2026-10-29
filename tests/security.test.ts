// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { read, root, walk } from './helpers'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const appSource = walk('src').filter(
  (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('src/test/') && !f.includes('components/design/'),
)

describe('code that can hurt visitors', () => {
  it('never writes HTML or runs strings as code', () => {
    const banned = [/dangerouslySetInnerHTML/, /\.innerHTML\s*=/, /\bouterHTML\s*=/, /\beval\s*\(/, /new Function\s*\(/, /document\.write\s*\(/]
    for (const file of appSource) {
      const text = read(file)
      for (const pattern of banned) expect(text, `${file} matches ${pattern}`).not.toMatch(pattern)
    }
  })

  it('shows people friendly messages, never a raw server message', () => {
    for (const file of appSource.filter((f) => f.startsWith('src/components/'))) {
      expect(read(file), file).not.toMatch(/\b(error|e|err)\.message\b/)
    }
  })
})

describe('secrets', () => {
  const published = ['index.html', '.env.example', 'vite.config.ts', 'vercel.json', ...appSource, ...walk('public').filter((f) => /\.(txt|json|webmanifest|svg|html)$/.test(f))]

  it('keeps the powerful service key out of everything that ships', () => {
    for (const file of published) expect(read(file), file).not.toMatch(/service_role/i)
  })

  it('has no keys or tokens pasted into published files', () => {
    for (const file of published) expect(read(file), file).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/)
  })

  it('ships an example settings file with no values filled in', () => {
    for (const line of read('.env.example').split('\n').filter((l) => /^VITE_\w+=/.test(l))) {
      expect(line, line).toMatch(/^VITE_\w+=$/)
    }
  })

  it('keeps local settings files out of version control', () => {
    expect(read('.gitignore')).toMatch(/^\*\.local$/m)
    expect(existsSync(join(root, '.env.example'))).toBe(true)
  })
})

describe('browser protections (vercel.json)', () => {
  const config = JSON.parse(read('vercel.json')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const headerMap = (source: string) =>
    Object.fromEntries((config.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [h.key, h.value]))
  const all = headerMap('/(.*)')
  const csp = all['Content-Security-Policy'] ?? ''
  const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))

  it('only allows scripts from this site, with no inline or eval escape hatch', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
    expect(directive('default-src')).toBe("default-src 'self'")
  })

  it('blocks embedding in other sites, plugins and base-tag tricks', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
  })

  it('lets the app talk only to itself and Supabase', () => {
    const connect = directive('connect-src') ?? ''
    expect(connect).toMatch(/^connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co$/)
  })

  it('sets the standard hardening headers', () => {
    expect(all['X-Content-Type-Options']).toBe('nosniff')
    expect(all['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(all['Strict-Transport-Security']).toMatch(/max-age=(\d+)/)
    expect(Number(/max-age=(\d+)/.exec(all['Strict-Transport-Security'])![1])).toBeGreaterThanOrEqual(31_536_000)
    for (const feature of ['camera', 'microphone', 'geolocation']) {
      expect(all['Permissions-Policy']).toContain(`${feature}=()`)
    }
    expect(all['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('caches fingerprinted assets for a year without revalidating', () => {
    expect(headerMap('/assets/(.*)')['Cache-Control']).toBe('public, max-age=31536000, immutable')
  })
})
