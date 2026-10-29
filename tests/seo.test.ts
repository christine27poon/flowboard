// @vitest-environment node
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { pngSize, read, root } from './helpers'

const doc = new JSDOM(read('index.html')).window.document
const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content') ?? ''
const exists = (relative: string) => existsSync(join(root, relative))

describe('what a search result shows', () => {
  it('has a descriptive title that fits in a result (60 characters or fewer)', () => {
    const title = doc.title
    expect(title.length).toBeGreaterThan(20)
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.toLowerCase()).toContain('kanban')
  })

  it('has a meta description that fits in a result (160 characters or fewer)', () => {
    const description = meta('meta[name="description"]')
    expect(description.length).toBeGreaterThan(70)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('is indexable and set to English', () => {
    expect(doc.documentElement.lang).toBe('en')
    expect(meta('meta[name="robots"]')).toContain('index')
    expect(meta('meta[name="robots"]')).not.toContain('noindex')
    expect(meta('meta[name="viewport"]')).toContain('width=device-width')
    expect(meta('meta[name="viewport"]')).not.toMatch(/user-scalable=no|maximum-scale=1\b/)
  })
})

describe('what a shared link shows', () => {
  it('has Open Graph tags', () => {
    expect(meta('meta[property="og:type"]')).toBe('website')
    expect(meta('meta[property="og:site_name"]')).toBe('Team Board')
    expect(meta('meta[property="og:title"]').length).toBeGreaterThan(10)
    expect(meta('meta[property="og:description"]').length).toBeGreaterThan(30)
  })

  it('has Twitter card tags for a large image', () => {
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(meta('meta[name="twitter:title"]').length).toBeGreaterThan(10)
    expect(meta('meta[name="twitter:description"]').length).toBeGreaterThan(30)
  })

  it('has a 1200×630 share image', () => {
    expect(pngSize('public/og-image.png')).toEqual({ width: 1200, height: 630 })
  })
})

describe('installability and icons', () => {
  it('links the manifest and icons', () => {
    expect(doc.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/site.webmanifest')
    expect(doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/apple-touch-icon.png')
    expect(doc.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href')).toBe('/favicon.svg')
  })

  it('has theme colours for light and dark', () => {
    const colours = [...doc.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('media'))
    expect(colours).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'])
  })

  it('has a valid manifest whose icons exist at the sizes they claim', () => {
    const manifest = JSON.parse(read('public/site.webmanifest')) as {
      name: string
      start_url: string
      display: string
      icons: { src: string; sizes: string; type: string }[]
    }
    expect(manifest.name).toBe('Team Board')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
      expect(exists(`public${icon.src}`), icon.src).toBe(true)
      const { width, height } = pngSize(`public${icon.src}`)
      expect(`${width}x${height}`, icon.src).toBe(icon.sizes)
    }
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
  })
})

describe('content for crawlers that do not run JavaScript', () => {
  const root_ = doc.getElementById('root')!

  it('ships real text inside the app root, not an empty box', () => {
    expect(root_.querySelectorAll('h1')).toHaveLength(1)
    expect(root_.textContent).toContain('kanban')
    expect(root_.querySelector('main')).not.toBeNull()
  })

  // So there is one consistent description whether or not scripts run.
  it('uses the same sentence as the sign-in screen', () => {
    const sentence = 'Plan work on simple kanban boards.'
    expect(root_.textContent!.replace(/\s+/g, ' ')).toContain(sentence)
    expect(read('src/components/AuthScreen.tsx').replace(/\s+/g, ' ')).toContain(sentence)
  })

  it('has no images without alt text, and no third-party links', () => {
    for (const img of doc.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true)
    const html = read('index.html')
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
  })

  it('has a short plain-language summary for AI assistants', () => {
    const llms = read('public/llms.txt')
    expect(llms.startsWith('# Team Board')).toBe(true)
    expect(llms).toContain('private')
    expect(llms.length).toBeLessThan(4000)
  })
})
