import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const root = resolve(import.meta.dirname, '..')

export const read = (relative: string) => readFileSync(join(root, relative), 'utf8')

/** All files under a folder (relative paths), skipping node_modules. */
export function walk(relative: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(root, relative))) {
    if (name === 'node_modules') continue
    const child = join(relative, name)
    if (statSync(join(root, child)).isDirectory()) out.push(...walk(child))
    else out.push(child)
  }
  return out
}

/** Width and height of a PNG, read from its header. */
export function pngSize(relative: string): { width: number; height: number } {
  const bytes = readFileSync(join(root, relative))
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${relative} is not a PNG`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** WCAG 2 contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
