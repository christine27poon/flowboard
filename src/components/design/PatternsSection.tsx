import { Section, Sub } from './Section'

export function PatternsSection() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      intro="How the pieces behave together. These are the decisions to repeat when adding a feature."
    >
      <Sub title="Every data-driven view has four states">
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">What people see</th>
                <th scope="col">How it’s built</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Loading</th>
                <td>“Loading your boards…”</td>
                <td><code>.state</code> with <code>role="status"</code></td>
              </tr>
              <tr>
                <th scope="row">Empty</th>
                <td>“No cards” in the column</td>
                <td><code>.column__empty</code>, muted and centered. Empty is normal, not a failure.</td>
              </tr>
              <tr>
                <th scope="row">Error</th>
                <td>“Couldn’t load your boards: …” and a <strong>Try again</strong> button</td>
                <td><code>.state</code> with <code>role="alert"</code> and a primary button</td>
              </tr>
              <tr>
                <th scope="row">Saved / failed save</th>
                <td>Change appears at once. If it can’t be saved: “That change couldn’t be saved (…). Your boards were reloaded from your account.”</td>
                <td>Optimistic update; writes are queued in order; on failure the data is reloaded and an error notice shows</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Sub>

      <Sub title="Forms">
        <ul className="ds-list">
          <li>Validate when the person submits, not while they type. Show every problem at once, under its field.</li>
          <li>Titles, assignees and board names are trimmed before saving. Required: card title, assignee, due date and board name.</li>
          <li>Length limits match the database, so nothing is rejected after the fact: title 200, assignee 100, description 10,000, board name 30 characters, password at least 8.</li>
          <li>In the side panel, “Save changes” stays disabled until something changes. After saving, a quiet “Saved ✓” appears beside it and the panel stays open.</li>
          <li>Closing the panel or dialog without saving discards the edits, so keep forms short.</li>
        </ul>
      </Sub>

      <Sub title="Dragging cards">
        <ul className="ds-list">
          <li>Drag a card to any column. The card dims to 40%; the target column gets a dashed accent outline.</li>
          <li>Order within a column is kept, and saved, so a card stays where it was dropped.</li>
          <li><strong>Dragging is never the only way.</strong> Open a card and change its Column. Moving a card this way sends it to the end of the new column.</li>
        </ul>
      </Sub>

      <Sub title="Destructive actions">
        <ul className="ds-list">
          <li><strong>Delete a card</strong> happens at once and is reversible: an “Undo” message appears and takes focus, so one click or key press brings the card back to the same place.</li>
          <li><strong>Delete a board</strong> takes two steps and names the cost: “Delete “Work” and its 4 cards? This can’t be undone.” with “Yes, delete board” and “Keep it”.</li>
          <li>The last board can’t be deleted, so there is always somewhere to put a card.</li>
          <li>Destructive buttons use <code>btn--danger</code> and are kept apart from the primary action.</li>
        </ul>
      </Sub>

      <Sub title="Which surface for what">
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Need</th>
                <th scope="col">Use</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Create a card or a board, rename a board</th><td>Dialog</td></tr>
              <tr><th scope="row">Read or edit one card in full, including its description</th><td>Side panel</td></tr>
              <tr><th scope="row">Tell people something changed or failed</th><td>Notice above the board</td></tr>
              <tr><th scope="row">Confirm something you can’t undo</th><td>Inline confirmation inside the dialog</td></tr>
              <tr><th scope="row">Switch context</th><td>Page links (Home, Design system), the board switcher and the breadcrumb (within a board)</td></tr>
            </tbody>
          </table>
        </div>
      </Sub>

      <Sub title="Voice and tone">
        <p>
          Calm, quick and never guilt-inducing. The app is for getting things down and moving on, so it
          speaks like a helpful friend, not a project manager.
        </p>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Instead of</th>
                <th scope="col">Write</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="ds-muted">“Error: invalid input”</td><td>“Title is required”</td></tr>
              <tr><td className="ds-muted">“Task overdue!”</td><td>“Jan 5, 2030 (overdue)”, in a calm color</td></tr>
              <tr><td className="ds-muted">“Failed to save. Try again.”</td><td>“That change couldn’t be saved (…). Your boards were reloaded from your account.”</td></tr>
              <tr><td className="ds-muted">“No tasks found”</td><td>“No cards”</td></tr>
              <tr><td className="ds-muted">“Are you sure?”</td><td>“Delete “Home” and its 2 cards? This can’t be undone.”</td></tr>
            </tbody>
          </table>
        </div>
        <ul className="ds-list">
          <li>Say what happened, then what to do or what was done about it.</li>
          <li>Buttons are verbs: “Add card”, “Save changes”, “Create board”.</li>
          <li>Priority is a label people choose for themselves, not a judgment. No streaks, scores or nagging.</li>
        </ul>
      </Sub>

      <Sub title="Theming">
        <ul className="ds-list">
          <li>Light and dark both follow the system setting; there is no in-app toggle yet.</li>
          <li>All themed values are tokens on <code>:root</code>, redefined inside <code>@media (prefers-color-scheme: dark)</code>. To add a token, define it in both places.</li>
          <li>In dark mode the pastels become deep, muted versions of the same hues, and the accent lightens so it keeps its contrast on dark surfaces.</li>
        </ul>
      </Sub>
    </Section>
  )
}
