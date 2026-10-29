import { Section, Sub } from './Section'
import { TYPE_SCALE } from './tokens'

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      intro={
        <>
          One friendly rounded family, <strong>Nunito</strong>, loaded from Google Fonts in{' '}
          <code>index.html</code>. If it can’t load (offline), the stack falls back to the system font.
        </>
      }
    >
      <Sub title="Font stack">
        <pre className="ds-code">{`'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`}</pre>
        <p>
          Weights in use: <strong>400</strong> regular (body, input text), <strong>600</strong>{' '}
          semibold (labels, captions), <strong>700</strong> bold (card titles, tabs, badges),{' '}
          <strong>800</strong> extra bold (headings). Base line height is 1.4; the description box uses
          1.5 for easier reading of longer notes.
        </p>
      </Sub>

      <Sub title="Scale">
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Style</th>
                <th scope="col">Specimen</th>
                <th scope="col">Size / weight</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_SCALE.map((t) => (
                <tr key={t.name}>
                  <th scope="row">{t.name}</th>
                  <td>
                    <span style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: 1.2 }}>{t.sample}</span>
                  </td>
                  <td>
                    {t.size} ({t.px}px) · {t.weight}
                  </td>
                  <td className="ds-muted">{t.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sub>

      <Sub title="Guidelines">
        <ul className="ds-list">
          <li>Sizes are in <code>rem</code> so they follow the person’s browser text-size setting.</li>
          <li>Heading levels follow the page structure, not the look: the app name is the page’s only <code>h1</code>; columns, dialogs and the panel use <code>h2</code>; card titles are <code>h3</code>.</li>
          <li>Long titles and descriptions wrap (<code>overflow-wrap: anywhere</code>) so a card never forces sideways scrolling. Card descriptions clamp to two lines; the full text lives in the side panel.</li>
          <li>Keep copy short and sentence case: “New card”, “Save changes”, never ALL CAPS.</li>
        </ul>
      </Sub>
    </Section>
  )
}
