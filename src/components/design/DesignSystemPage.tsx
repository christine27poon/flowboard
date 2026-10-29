import { useEffect, useRef } from 'react'
import { AccessibilitySection } from './AccessibilitySection'
import { ColorSection } from './ColorSection'
import { ComponentsSection } from './ComponentsSection'
import { FoundationsSection } from './FoundationsSection'
import { PatternsSection } from './PatternsSection'
import { Section, Sub } from './Section'
import { TypographySection } from './TypographySection'
import './design.css'

const TOC = [
  ['principles', 'Principles'],
  ['color', 'Color'],
  ['typography', 'Typography'],
  ['foundations', 'Spacing, shape, motion'],
  ['components', 'Components'],
  ['patterns', 'Patterns'],
  ['accessibility', 'Accessibility'],
  ['reference', 'Where things live'],
] as const

const PRINCIPLES = [
  ['Calm over busy', 'A board is full of things to do. The interface stays quiet: soft color, plenty of room, one accent, no alarms.'],
  ['Scannable at a glance', 'Each stage has its own tint, each card shows only what you need to decide what to open, and priority is a word on a badge.'],
  ['Soft and friendly', 'Rounded type, softly rounded buttons and corners, and pastel color. It should feel like a tidy desk, not a ticketing system.'],
  ['Kind by default', 'Plain, warm, neutral language. Mistakes are explained, never blamed. Overdue is information, not a reprimand.'],
  ['Accessible to everyone', 'AA contrast, keyboard access, visible focus, finger-sized targets and reduced motion are part of every component, not a later pass.'],
] as const

export function DesignSystemPage() {
  const heading = useRef<HTMLHeadingElement>(null)

  // Land on the page's heading so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <main id="main" tabIndex={-1} className="ds">
      <header className="ds-header">
        <h2 ref={heading} tabIndex={-1}>
          Design system
        </h2>
        <p className="ds-lead">
          The colors, type, shapes and components behind Team Board, and the rules for using them. The
          examples on this page are live: they use the app’s own components and read their values from
          the app’s own styles, so what you see here is what ships.
        </p>
      </header>

      <nav className="ds-toc" aria-label="On this page">
        <ul>
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#ds-${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-content">
        <Section id="principles" title="Principles">
          <ul className="ds-principles">
            {PRINCIPLES.map(([title, body]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span className="ds-muted">{body}</span>
              </li>
            ))}
          </ul>
        </Section>

        <ColorSection />
        <TypographySection />
        <FoundationsSection />
        <ComponentsSection />
        <PatternsSection />
        <AccessibilitySection />

        <Section id="reference" title="Where things live">
          <Sub title="Source map">
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th scope="col">Path</th>
                    <th scope="col">What’s there</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row"><code>src/index.css</code></th><td>All design tokens (light and dark), base styles and every component’s styles, in sections: buttons, layout, columns, cards, board header and switcher, Home, dialogs, side panel, forms, account screens.</td></tr>
                  <tr><th scope="row"><code>index.html</code></th><td>The Nunito font link.</td></tr>
                  <tr><th scope="row"><code>src/components/</code></th><td>One component per file: <code>Board</code>, <code>Column</code>, <code>Card</code>, <code>CardForm</code>, <code>CardModal</code>, <code>CardPanel</code>, <code>BoardHeader</code>, <code>BoardSwitcher</code>, <code>BoardTile</code>, <code>HomePage</code>, <code>BoardModal</code>, <code>Dialog</code>, <code>ImportBanner</code>, <code>AuthScreen</code>, <code>WorkspaceView</code>.</td></tr>
                  <tr><th scope="row"><code>src/components/design/</code></th><td>This page. <code>tokens.ts</code> lists the colors, type scale, spacing and radii it documents; <code>contrast.ts</code> and <code>theme.ts</code> read the live values.</td></tr>
                  <tr><th scope="row"><code>src/types.ts</code></th><td>The domain types: <code>Board</code>, <code>Card</code>, statuses and priorities.</td></tr>
                </tbody>
              </table>
            </div>
          </Sub>

          <Sub title="Adding to the system">
            <ol className="ds-list">
              <li>Look for an existing token, class or component first.</li>
              <li>New color: add the token in <code>:root</code> <em>and</em> the dark block, then add it to <code>tokens.ts</code>; the contrast table will tell you if it works.</li>
              <li>New component: reuse the spacing, radius, border and shadow values above, give it loading, empty and error states if it shows data, and make sure it works by keyboard.</li>
              <li>Show it on this page with the real component, and write down when to use it.</li>
              <li>Check it at 375px, 768px and 1280px, in light and dark.</li>
            </ol>
          </Sub>
        </Section>
      </div>
    </main>
  )
}
