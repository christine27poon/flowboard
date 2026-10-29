import axe from 'axe-core'

/**
 * Run the axe accessibility engine over part of the page and return readable problem strings
 * (empty means none). Colour contrast is skipped because jsdom does no layout or styling; the
 * palette's contrast is checked from the CSS values in tests/css.test.ts instead.
 */
export async function axeViolations(root: Element): Promise<string[]> {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
}
