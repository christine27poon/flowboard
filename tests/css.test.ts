// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { contrast, read } from './helpers'

const css = read('src/index.css')

/** The text between the braces that open at `from` (nested braces handled). */
function block(source: string, from: number): string {
  const open = source.indexOf('{', from)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  throw new Error('unbalanced braces')
}

const vars = (body: string) =>
  Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]))

const light = vars(block(css, css.indexOf(':root')))
const darkMedia = css.indexOf('@media (prefers-color-scheme: dark)')
const dark = { ...light, ...vars(block(css, css.indexOf(':root', darkMedia))) }

const tints = ['backlog', 'in-progress', 'in-review', 'done']

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme contrast (WCAG 1.4.3 and 1.4.11)', (_name, t) => {
  it('reads the palette', () => {
    expect(t.text).toMatch(/^#/)
    expect(t['text-muted']).toMatch(/^#/)
  })

  it('body and muted text reach 4.5:1 on every surface and column colour', () => {
    for (const bg of ['bg', 'surface', ...tints]) {
      expect(contrast(t.text, t[bg]), `text on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['text-muted'], t[bg]), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  // Placeholders use --text-muted on the field fill (--bg), so this is the placeholder contrast too.
  it('placeholder text (muted on the field fill) reaches 4.5:1', () => {
    expect(contrast(t['text-muted'], t.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('links, buttons and errors reach 4.5:1', () => {
    expect(contrast(t['accent-text'], t.accent)).toBeGreaterThanOrEqual(4.5)
    for (const bg of ['bg', 'surface']) expect(contrast(t.accent, t[bg]), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5)
    for (const bg of ['bg', 'surface', 'backlog']) {
      expect(contrast(t.danger, t[bg]), `danger on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('priority badges reach 4.5:1', () => {
    for (const level of ['high', 'medium', 'low']) {
      expect(contrast(t[`${level}-text`], t[level]), level).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('form field outlines reach 3:1 against the page and card colours', () => {
    for (const bg of ['bg', 'surface']) {
      expect(contrast(t['control-border'], t[bg]), `outline on ${bg}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the focus ring reaches 3:1 on every surface and column colour', () => {
    for (const bg of ['bg', 'surface', ...tints]) {
      expect(contrast(t.accent, t[bg]), `focus ring on ${bg}`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('accessibility rules are still in the stylesheet', () => {
  it('draws a 3px focus ring on keyboard focus', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--accent\)/)
  })

  it('gives placeholders a readable colour instead of the browser default', () => {
    expect(css).toMatch(/::placeholder[\s\S]*?color:\s*var\(--text-muted\)[\s\S]*?opacity:\s*1/)
  })

  it('lets native controls follow the dark theme', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/)
  })

  it('keeps things visible in Windows High Contrast', () => {
    const forced = block(css, css.indexOf('@media (forced-colors: active)'))
    expect(forced).toContain('.progress__bar')
    expect(forced).toContain('.card--new')
    expect(forced).toContain('.switcher__item')
  })

  it('turns off animation for people who ask for less motion', () => {
    const reduced = block(css, css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/transition:\s*none/)
    expect(reduced).toMatch(/animation:\s*none/)
  })

  it('keeps a focused field clear of the card panel’s sticky header', () => {
    expect(css).toMatch(/\.panel\s*\{\s*scroll-padding-top:\s*\d+px/)
  })

  it('enlarges tap targets on touch devices, including hybrids', () => {
    const coarse = block(css, css.indexOf('@media (any-pointer: coarse)'))
    expect(coarse).toMatch(/min-height:\s*44px/)
    expect(css).not.toContain('@media (pointer: coarse)')
  })

  it('has the screen-reader-only helper and the skip link', () => {
    expect(css).toMatch(/\.visually-hidden\s*\{/)
    expect(css).toMatch(/\.skip-link\s*\{/)
    expect(css).toMatch(/\.skip-link:focus\s*\{/)
  })

  it('never sets text smaller than 12px', () => {
    for (const [, size] of css.matchAll(/font-size:\s*([\d.]+)rem/g)) {
      expect(Number(size), `font-size ${size}rem`).toBeGreaterThanOrEqual(0.75)
    }
  })
})
