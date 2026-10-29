// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { root } from './helpers'

/**
 * Runs the real production build into a temporary folder, with test values for the settings it
 * reads (so it is repeatable, and never bakes the real project key into anything).
 */
async function buildSite(siteUrl: string) {
  const outDir = mkdtempSync(join(tmpdir(), 'flowboard-build-'))
  const settings = {
    VITE_SUPABASE_URL: 'https://test-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_SITE_URL: siteUrl,
    // Vitest runs with NODE_ENV=test, which would bundle React's larger development build.
    NODE_ENV: 'production',
  }
  const saved = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]]))
  Object.assign(process.env, settings)
  try {
    await build({
      root,
      configFile: resolve(root, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    })
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
  const read = (name: string) => readFileSync(join(outDir, name), 'utf8')
  const has = (name: string) => existsSync(join(outDir, name))
  const doc = new JSDOM(read('index.html')).window.document
  const assets = readdirSync(join(outDir, 'assets'))
  const asset = (pattern: RegExp) => assets.find((a) => pattern.test(a))
  const size = (name: string) => statSync(join(outDir, 'assets', name)).size
  return { outDir, read, has, doc, assets, asset, size }
}

type Site = Awaited<ReturnType<typeof buildSite>>
const sites: Site[] = []
let plain: Site
let withUrl: Site
let insecure: Site

beforeAll(async () => {
  plain = await buildSite('') // nothing configured yet: the not-deployed-yet case
  withUrl = await buildSite('https://teamboard.example.com')
  insecure = await buildSite('http://teamboard.example.com')
  sites.push(plain, withUrl, insecure)
}, 120_000)

afterAll(() => {
  for (const site of sites) rmSync(site.outDir, { recursive: true, force: true })
})

const head = (site: Site, selector: string) => site.doc.querySelector(selector)

describe('production build: security policy', () => {
  it('limits scripts to this site and the app to itself and Supabase', () => {
    const csp = head(plain, 'meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''
    const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(directive('connect-src')).toBe("connect-src 'self' https://test-project.supabase.co")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('has no inline scripts that run code (the JSON description is data)', () => {
    for (const script of plain.doc.querySelectorAll('script')) {
      const type = script.getAttribute('type')
      if (type === 'application/ld+json') continue
      expect(script.textContent?.trim(), 'inline script').toBe('')
    }
  })

  it('does not bake the real project key or any Google Fonts address into the output', () => {
    const everything = [plain.read('index.html'), ...plain.assets.filter((a) => /\.(js|css)$/.test(a)).map((a) => plain.read(`assets/${a}`))].join('\n')
    expect(everything).not.toContain('fonts.googleapis.com')
    expect(everything).not.toContain('ijcadrwviiratkcnrxnc')
    expect(everything).not.toMatch(/service_role/i)
  })
})

describe('production build: search and sharing, before a site address is known', () => {
  it('writes the description, structured data and a Supabase preconnect', () => {
    expect(plain.doc.title.length).toBeLessThanOrEqual(60)
    const ld = JSON.parse(head(plain, 'script[type="application/ld+json"]')!.textContent!)
    expect(ld).toMatchObject({ '@type': 'WebApplication', name: 'Team Board', applicationCategory: 'ProductivityApplication' })
    expect(ld.description.length).toBeLessThanOrEqual(160)
    expect(ld.url).toBeUndefined()
    expect(head(plain, 'link[rel="preconnect"]')?.getAttribute('href')).toBe('https://test-project.supabase.co')
  })

  it('leaves out tags that would need an address it does not have', () => {
    expect(head(plain, 'link[rel="canonical"]')).toBeNull()
    expect(head(plain, 'meta[property="og:url"]')).toBeNull()
    expect(head(plain, 'meta[property="og:image"]')).toBeNull()
    expect(plain.has('sitemap.xml')).toBe(false)
  })

  it('keeps crawlers out of the duplicate ?board, ?page and ?card addresses', () => {
    const robots = plain.read('robots.txt')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    for (const query of ['board', 'page', 'card']) expect(robots).toContain(`Disallow: /*?${query}=`)
    expect(robots).not.toContain('Sitemap:')
  })

  it('copies the public files across', () => {
    for (const name of ['favicon.svg', 'site.webmanifest', 'llms.txt', 'og-image.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      expect(plain.has(name), name).toBe(true)
    }
  })
})

describe('production build: search and sharing, with a site address', () => {
  it('adds the canonical link and absolute share URLs', () => {
    const site = 'https://teamboard.example.com/'
    expect(head(withUrl, 'link[rel="canonical"]')?.getAttribute('href')).toBe(site)
    expect(head(withUrl, 'meta[property="og:url"]')?.getAttribute('content')).toBe(site)
    expect(head(withUrl, 'meta[property="og:image"]')?.getAttribute('content')).toBe(`${site}og-image.png`)
    expect(head(withUrl, 'meta[name="twitter:image"]')?.getAttribute('content')).toBe(`${site}og-image.png`)
    expect(head(withUrl, 'meta[property="og:image:width"]')?.getAttribute('content')).toBe('1200')
    expect(head(withUrl, 'meta[property="og:image:alt"]')?.getAttribute('content')).toContain('Team Board')
    expect(JSON.parse(head(withUrl, 'script[type="application/ld+json"]')!.textContent!).url).toBe(site)
  })

  it('writes a valid sitemap for the one public page and points robots.txt at it', () => {
    const xml = new JSDOM(withUrl.read('sitemap.xml'), { contentType: 'text/xml' }).window.document
    expect(xml.querySelectorAll('url')).toHaveLength(1)
    expect(xml.querySelector('loc')?.textContent).toBe('https://teamboard.example.com/')
    expect(xml.querySelector('lastmod')?.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(withUrl.read('robots.txt')).toContain('Sitemap: https://teamboard.example.com/sitemap.xml')
  })

  it('ignores an address that is not https', () => {
    expect(head(insecure, 'link[rel="canonical"]')).toBeNull()
    expect(insecure.has('sitemap.xml')).toBe(false)
    expect(insecure.read('robots.txt')).not.toContain('Sitemap:')
  })
})

describe('production build: speed', () => {
  it('splits the workspace and the docs page out of the sign-in bundle', () => {
    expect(plain.asset(/^WorkspaceView-.*\.js$/)).toBeDefined()
    expect(plain.asset(/^DesignSystemPage-.*\.js$/)).toBeDefined()
  })

  it('keeps the main bundle within budget (480 KB, uncompressed)', () => {
    const entry = plain.asset(/^index-.*\.js$/)!
    expect(plain.size(entry)).toBeLessThan(480_000)
  })

  it('serves fonts from this site as woff2 files, not inlined and not from Google', () => {
    expect(plain.assets.filter((a) => /nunito-latin-.*\.woff2$/.test(a))).toHaveLength(4)
    const css = plain.read(`assets/${plain.asset(/^index-.*\.css$/)!}`)
    expect(css).not.toMatch(/url\(data:font/)
  })

  it('does not load the main script before the page has what it needs to paint', () => {
    const script = head(plain, 'script[type="module"]')
    expect(script?.getAttribute('src')).toMatch(/^\/assets\/index-.*\.js$/)
  })
})
