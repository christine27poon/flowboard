import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Adds a Content-Security-Policy to the built page: scripts, styles and fonts may only come from
 * this site, and the app may only talk to this site and the Supabase project. It is skipped in
 * development, where the dev server needs inline scripts for hot reload.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const connect = ["'self'"]
  try {
    if (supabaseUrl) connect.push(new URL(supabaseUrl).origin)
  } catch {
    // An invalid URL just means no extra origin is allowed.
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')

  return {
    name: 'flowboard-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  }
}

const DESCRIPTION =
  'Team Board is a simple kanban board for planning work. Create boards, track due dates and priorities, search cards, and keep everything private to your account.'

/** The public https address from VITE_SITE_URL, as `https://host/`; undefined if unset or invalid. */
function siteOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? `${url.origin}/` : undefined
  } catch {
    return undefined
  }
}

/**
 * Search and social tags that depend on where the site is deployed, plus robots.txt and
 * sitemap.xml. The only public page is the sign-in screen at "/"; the ?board= / ?page= / ?card=
 * addresses are the same screen to a crawler, so they are kept out of the index. Tags that need
 * the site's address (canonical, share image, sitemap) are written only when VITE_SITE_URL is set.
 */
function seo(siteUrl: string | undefined, supabaseUrl: string | undefined): Plugin {
  const site = siteOrigin(siteUrl)
  let supabaseOrigin: string | undefined
  try {
    if (supabaseUrl) supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    // No preconnect if the URL is invalid.
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Team Board',
    description: DESCRIPTION,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en',
    featureList: [
      'Kanban boards with Backlog, In Progress, In Review and Done columns',
      'Due dates, priorities and assignees on every card',
      'Search and priority filters',
      'A Home page that summarizes every board and what is due soon',
      'Keyboard and screen-reader accessible, with light and dark themes',
    ],
    ...(site ? { url: site } : {}),
  }

  const robots = [
    "# Team Board's only public page is the sign-in screen. Boards and cards are private to each account.",
    'User-agent: *',
    'Allow: /',
    'Disallow: /*?board=',
    'Disallow: /*?page=',
    'Disallow: /*?card=',
    '',
    '# To also keep AI training crawlers out, add a block per bot, for example:',
    '# User-agent: GPTBot',
    '# Disallow: /',
    ...(site ? ['', `Sitemap: ${site}sitemap.xml`] : []),
    '',
  ].join('\n')

  return {
    name: 'flowboard-seo',
    apply: 'build',
    transformIndexHtml: () => [
      ...(supabaseOrigin
        ? [{ tag: 'link', attrs: { rel: 'preconnect', href: supabaseOrigin }, injectTo: 'head' as const }]
        : []),
      ...(site
        ? [
            { tag: 'link', attrs: { rel: 'canonical', href: site }, injectTo: 'head' as const },
            { tag: 'meta', attrs: { property: 'og:url', content: site }, injectTo: 'head' as const },
            { tag: 'meta', attrs: { property: 'og:image', content: `${site}og-image.png` }, injectTo: 'head' as const },
            { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' as const },
            { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' as const },
            {
              tag: 'meta',
              attrs: { property: 'og:image:alt', content: 'Team Board: simple kanban boards for tasks, due dates and priorities.' },
              injectTo: 'head' as const,
            },
            { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}og-image.png` }, injectTo: 'head' as const },
            {
              tag: 'meta',
              attrs: { name: 'twitter:image:alt', content: 'Team Board: simple kanban boards for tasks, due dates and priorities.' },
              injectTo: 'head' as const,
            },
          ]
        : []),
      {
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        children: JSON.stringify(jsonLd),
        injectTo: 'head' as const,
      },
    ],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      if (site) {
        const today = new Date().toISOString().slice(0, 10)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${site}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n</urlset>\n`,
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
      react(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL),
      seo(env.VITE_SITE_URL, env.VITE_SUPABASE_URL),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
      css: false,
      restoreMocks: true,
      // Never point anything at the real project, even if a test forgot to use the fake.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/components/design/**', 'src/data/database.types.ts'],
      },
    },
  }
})
