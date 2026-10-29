import { contrastRatio } from './contrast'
import { Section, Sub } from './Section'
import { readToken, useColorScheme } from './theme'
import { COLOR_GROUPS, CONTRAST_PAIRS } from './tokens'

export function ColorSection() {
  const scheme = useColorScheme()

  return (
    <Section
      id="color"
      title="Color"
      intro={
        <>
          A soft pastel palette on a blush canvas, with one purple accent. Every color is a CSS custom
          property on <code>:root</code> in <code>src/index.css</code>; components use these
          tokens rather than raw hex values. The palette follows the system appearance, and each token has a light and a dark
          value.
        </>
      }
    >
      <p className="ds-note" role="status">
        Values below are read live from the page: you’re seeing the <strong>{scheme}</strong> palette.
        Change your system appearance to see the other one.
      </p>

      {COLOR_GROUPS.map((group) => (
        <Sub key={group.title} title={group.title}>
          <p className="ds-muted">{group.blurb}</p>
          <ul className="ds-swatches">
            {group.tokens.map((token) => (
              <li key={token.name} className="ds-swatch">
                <span className="ds-swatch__chip" style={{ background: `var(${token.name})` }} aria-hidden="true" />
                <span className="ds-swatch__text">
                  <code>{token.name}</code>
                  <span className="ds-swatch__value">{readToken(token.name)}</span>
                  <span className="ds-muted">{token.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </Sub>
      ))}

      <Sub title="Page background">
        <p>
          In the light theme the canvas has two faint radial glows (pink at the top left, periwinkle at
          the top right) fixed to the viewport. In the dark theme it is the flat <code>--bg</code>.
          The two glow colors, and the dialog and panel shadows, are the only literal colors outside the token list.
        </p>
      </Sub>

      <Sub title="Contrast, checked live">
        <p>
          Text needs 4.5:1 (WCAG AA). Boundaries a person must see to use a control, and the focus
          ring, need 3:1. Ratios are computed in your browser from the tokens above, so this table
          can’t drift from the real colors.
        </p>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Pair</th>
                <th scope="col">Sample</th>
                <th scope="col">Ratio</th>
                <th scope="col">Needs</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST_PAIRS.map((pair) => {
                const ratio = contrastRatio(readToken(pair.fg), readToken(pair.bg))
                const pass = ratio >= pair.min
                return (
                  <tr key={`${pair.fg}-${pair.bg}-${pair.label}`}>
                    <th scope="row">
                      {pair.label}
                      <span className="ds-muted ds-pair">
                        <code>{pair.fg}</code> on <code>{pair.bg}</code>
                      </span>
                    </th>
                    <td>
                      <span
                        className="ds-sample"
                        style={{
                          color: `var(${pair.fg})`,
                          background: `var(${pair.bg})`,
                          borderColor: pair.kind === 'UI' ? `var(${pair.fg})` : undefined,
                        }}
                        aria-hidden="true"
                      >
                        Aa
                      </span>
                    </td>
                    <td>{Number.isNaN(ratio) ? '—' : `${ratio.toFixed(2)}:1`}</td>
                    <td>{pair.min}:1</td>
                    <td>
                      <span className={`ds-result ds-result--${pass ? 'pass' : 'fail'}`}>
                        {pass ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Sub>

      <Sub title="Using color">
        <ul className="ds-list">
          <li>Pick a token by role, not by how it looks. Need a new shade? Add a token for both themes, then check it in the table above.</li>
          <li>Color never carries meaning alone: priority is written on the badge, an overdue date says “(overdue)”, errors come with a message, and the current tab is filled <em>and</em> marked <code>aria-current</code>.</li>
          <li>Pastels are for large surfaces. Text on them uses <code>--text</code> or <code>--text-muted</code>, never a lighter tint.</li>
        </ul>
      </Sub>
    </Section>
  )
}
