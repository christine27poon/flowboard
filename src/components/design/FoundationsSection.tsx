import { Section, Sub } from './Section'
import { RADII, SPACING_STEPS } from './tokens'

export function FoundationsSection() {
  return (
    <Section
      id="foundations"
      title="Spacing, shape and motion"
      intro="Generous space, gently rounded corners and soft shadows keep the board feeling calm, even when it is full."
    >
      <Sub title="Spacing">
        <p>
          There is no spacing token yet: values are written in <code>px</code> in the stylesheet, and
          these are the steps in use. Reach for an existing step before inventing a new one.
        </p>
        <ul className="ds-spacing">
          {SPACING_STEPS.map((step) => (
            <li key={step.px}>
              <span className="ds-spacing__label">{step.px}px</span>
              <span className="ds-spacing__bar" style={{ width: step.px }} aria-hidden="true" />
              <span className="ds-muted">{step.usage}</span>
            </li>
          ))}
        </ul>
      </Sub>

      <Sub title="Corner radius">
        <ul className="ds-radii">
          {RADII.map((r) => (
            <li key={r.px}>
              <span className="ds-radii__box" style={{ borderRadius: r.px }} aria-hidden="true" />
              <span>
                <code>{r.px}</code>
                <span className="ds-muted ds-pair">{r.usage}</span>
              </span>
            </li>
          ))}
        </ul>
      </Sub>

      <Sub title="Borders and outlines">
        <ul className="ds-list">
          <li><strong>2px solid <code>--border</code></strong> on cards, tiles, dialogs and buttons.</li>
          <li><strong>2px solid <code>--control-border</code></strong> on form fields, darker so the field is findable.</li>
          <li><strong>2px dashed <code>--accent</code></strong> around a column that a dragged card is hovering over.</li>
          <li><strong>3px solid <code>--accent</code>, 2px offset</strong> is the global keyboard focus ring (<code>:focus-visible</code>). Never remove it.</li>
        </ul>
      </Sub>

      <Sub title="Elevation">
        <div className="ds-shadows">
          <figure>
            <div className="ds-shadow-box" style={{ boxShadow: 'var(--shadow)' }} />
            <figcaption>
              <code>--shadow</code>
              <span className="ds-muted">Cards, hovered buttons, the current tab, the sign-in card. Adjusts for dark mode.</span>
            </figcaption>
          </figure>
          <figure>
            <div className="ds-shadow-box" style={{ boxShadow: '0 12px 40px rgb(111 79 184 / 0.25)' }} />
            <figcaption>
              <code>0 12px 40px</code>
              <span className="ds-muted">Centered dialogs, over a blurred, dimmed backdrop.</span>
            </figcaption>
          </figure>
          <figure>
            <div className="ds-shadow-box" style={{ boxShadow: '-12px 0 40px rgb(111 79 184 / 0.2)' }} />
            <figcaption>
              <code>-12px 0 40px</code>
              <span className="ds-muted">The side panel, cast to the left over the board.</span>
            </figcaption>
          </figure>
        </div>
      </Sub>

      <Sub title="Layout">
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Element</th>
                <th scope="col">Size</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Page gutter</th><td>20px each side</td></tr>
              <tr><th scope="row">Board</th><td>Four equal columns with a 16px gap. Under 1100px they wrap into two per row, and under 640px they stack into one, so the board never scrolls sideways.</td></tr>
              <tr><th scope="row">Dialog</th><td><code>min(480px, 100vw − 32px)</code>, centered</td></tr>
              <tr><th scope="row">Side panel</th><td><code>min(460px, 100vw)</code>, full height, docked right</td></tr>
              <tr><th scope="row">Sign-in card</th><td><code>min(400px, 100%)</code>, centered</td></tr>
              <tr><th scope="row">Breakpoint</th><td>Only one: at 480px and below, paired form fields (Priority / Due date) stack into one column.</td></tr>
            </tbody>
          </table>
        </div>
        <p>Layouts are checked at 375px, 768px and 1280px wide.</p>
      </Sub>

      <Sub title="Motion">
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Effect</th>
                <th scope="col">Timing</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Button hover</th><td>Lifts 1px, gains <code>--shadow</code>, outline darkens</td><td>0.12s ease</td></tr>
              <tr><th scope="row">Card hover</th><td>Lifts 2px and tilts −0.4°</td><td>0.12s ease</td></tr>
              <tr><th scope="row">Card being dragged</th><td>Fades to 40% opacity</td><td>Instant</td></tr>
              <tr><th scope="row">Side panel opening</th><td>Slides in from the right</td><td>0.2s ease-out</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Motion is small and only confirms what the person did. When the system asks for reduced
          motion, <strong>all</strong> transitions and animations are switched off.
        </p>
      </Sub>
    </Section>
  )
}
