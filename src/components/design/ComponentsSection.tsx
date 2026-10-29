import { useState } from 'react'
import type { Card as CardType } from '../../types'
import { Card } from '../Card'
import { CardForm } from '../CardForm'
import { Column } from '../Column'
import { Dialog } from '../Dialog'
import { Section, Sub } from './Section'

const noop = () => {}

const SAMPLE_CARDS: CardType[] = [
  {
    id: 'ds-1',
    boardId: 'ds',
    title: 'Retile the bathroom',
    assignee: 'Alex',
    priority: 'High',
    dueDate: '2030-01-05',
    status: 'backlog',
    description: 'Buy grout and spacers before the weekend.',
    position: 1,
    createdAt: '2030-01-01T09:00:00Z',
    updatedAt: '2030-01-01T09:00:00Z',
  },
  {
    id: 'ds-2',
    boardId: 'ds',
    title: 'Plan the garden bed',
    assignee: 'Sam',
    priority: 'Medium',
    dueDate: '2030-02-14',
    status: 'in-progress',
    description: '',
    position: 1,
    createdAt: '2030-01-01T09:00:00Z',
    updatedAt: '2030-01-01T09:00:00Z',
  },
  {
    id: 'ds-3',
    boardId: 'ds',
    title: 'Send the invoice',
    assignee: 'Kim',
    priority: 'Low',
    dueDate: '2020-03-01',
    status: 'in-review',
    description: 'Waiting on a final number.',
    position: 1,
    createdAt: '2030-01-01T09:00:00Z',
    updatedAt: '2030-01-01T09:00:00Z',
  },
]

export function ComponentsSection() {
  const [dialog, setDialog] = useState<'modal' | 'panel' | null>(null)

  return (
    <Section
      id="components"
      title="Components"
      intro={
        <>
          Everything below is the real thing: the same components and class names the board uses. Reuse
          these before building something new. Cards and columns here are illustrations; they don’t
          change your boards.
        </>
      }
    >
      <Sub title="Buttons">
        <div className="ds-demo ds-row">
          <button type="button" className="btn btn--primary">Primary</button>
          <button type="button" className="btn">Default</button>
          <button type="button" className="btn btn--danger">Danger</button>
          <button type="button" className="btn btn--ghost">Ghost</button>
          <button type="button" className="btn btn--primary btn--small">Small</button>
          <button type="button" className="btn btn--primary" disabled>Disabled</button>
        </div>
        <ul className="ds-list">
          <li><code>btn--primary</code>: the one main action of a view (“Add card”, “Save changes”, “Sign in”). One per surface.</li>
          <li><code>btn</code>: secondary actions such as Cancel, Close and Sign out.</li>
          <li><code>btn--danger</code>: destructive actions. Outlined, never filled, so it can’t be hit by reflex.</li>
          <li><code>btn--ghost</code>: low-emphasis, in-context actions like “Open” on a card, or “Edit board”.</li>
          <li><code>btn--small</code>: compact buttons inside headers and banners.</li>
          <li>Softly rounded (8px corners). 36px tall (28px for small and ghost) with a mouse, and <strong>44px on touch screens</strong>. A disabled button is dimmed to 50% and explains itself nearby (e.g. “Save changes” waits until something changes).</li>
          <li>Labels say what happens: “Add card”, “Delete board”, “Yes, delete board”. Icon-only buttons need an <code>aria-label</code>.</li>
        </ul>
      </Sub>

      <Sub title="Priority badges">
        <div className="ds-demo ds-row">
          <span className="badge badge--high">High</span>
          <span className="badge badge--medium">Medium</span>
          <span className="badge badge--low">Low</span>
        </div>
        <p>
          A badge is a self-reported label the person chooses, not a score. The word is always shown,
          so it never depends on color.
        </p>
      </Sub>

      <Sub title="Navigation">
        <p>Three pieces: page links, a board header with a switcher, and board tiles on Home.</p>
        <div className="ds-demo">
          <p className="ds-demo__label">Page links: Home (which includes every board) and this page</p>
          <div className="page-tabs" role="presentation">
            <span className="page-tab" aria-current="page">Home</span>
            <span className="page-tab">Design system</span>
          </div>
          <p className="ds-demo__label">Board header: breadcrumb, switcher, name and a stats line</p>
          <div className="board-header">
            <ol className="breadcrumb">
              <li><span className="breadcrumb__link">Home</span></li>
              <li className="breadcrumb__sep" aria-hidden="true">›</li>
              <li>
                <span className="switcher__button">
                  <span>Work</span>
                  <span aria-hidden="true" className="switcher__chevron">▾</span>
                </span>
              </li>
            </ol>
            <div className="board-header__main">
              <div className="board-header__title">
                <h4 style={{ fontSize: '1.5rem', margin: 0 }}>Work</h4>
                <p className="board-header__stats">
                  <span>12 cards</span>
                  <span>3 due this week</span>
                  <span className="overdue">1 overdue</span>
                </p>
              </div>
              <span className="btn btn--small">Edit board</span>
            </div>
          </div>
          <p className="ds-demo__label">Board tile on Home: counts, progress as words and a bar, due dates</p>
          <ul className="tiles" style={{ maxWidth: 280 }}>
            <li className="tile">
              <h4 className="tile__name">Work</h4>
              <p className="tile__total">12 cards</p>
              <dl className="tile__counts">
                <div><dt>Backlog</dt><dd>4</dd></div>
                <div><dt>In Progress</dt><dd>3</dd></div>
                <div><dt>In Review</dt><dd>1</dd></div>
                <div><dt>Done</dt><dd>4</dd></div>
              </dl>
              <div className="progress" aria-hidden="true"><span className="progress__bar" style={{ width: '33%' }} /></div>
              <p className="tile__progress">4 of 12 done</p>
              <p className="tile__due"><span className="overdue">1 overdue</span><span>3 due this week</span></p>
            </li>
          </ul>
        </div>
        <ul className="ds-list">
          <li>Page links and tile titles are real links, so they can be opened in a new tab. The current page carries <code>aria-current</code>, which is also what styles it.</li>
          <li>The switcher is a disclosure: a button with <code>aria-expanded</code> that reveals a list of board links. Escape closes it and returns focus to the button. It is not an ARIA menu, so Tab and Enter work as on any list of links.</li>
          <li>A tile is one link: the title’s link stretches over the whole tile. Progress is written (“4 of 12 done”); the bar is decoration. Board names are limited to 30 characters.</li>
        </ul>
      </Sub>

      <Sub title="Cards">
        <div className="ds-demo ds-cards">
          <Card card={SAMPLE_CARDS[0]} isDragging={false} isNew={false} onOpen={noop} onDragStart={noop} onDragEnd={noop} onDropOnCard={noop} />
          <Card card={SAMPLE_CARDS[1]} isDragging={false} isNew={false} onOpen={noop} onDragStart={noop} onDragEnd={noop} onDropOnCard={noop} />
          <Card card={SAMPLE_CARDS[2]} isDragging={false} isNew={false} onOpen={noop} onDragStart={noop} onDragEnd={noop} onDropOnCard={noop} />
          <Card card={SAMPLE_CARDS[0]} isDragging isNew={false} onOpen={noop} onDragStart={noop} onDragEnd={noop} onDropOnCard={noop} />
        </div>
        <p className="ds-muted">Left to right: with a description, without one, overdue, and while being dragged.</p>
        <ul className="ds-list">
          <li>Anatomy, top to bottom: priority badge and “Open” button, title, optional two-line description, then assignee and due date.</li>
          <li>The whole card is a click target for the side panel, and it is draggable. The “Open” button is the keyboard route in.</li>
          <li>A due date in the past on a card that isn’t Done turns <code>--danger</code> and adds “(overdue)”. It is information, not a scolding.</li>
        </ul>
      </Sub>

      <Sub title="Columns and the board">
        <div className="ds-demo">
          <div className="board ds-board">
            <Column status="backlog" cards={[SAMPLE_CARDS[0]]} draggingId={null} newCardId={null} filtered={false} onOpen={noop} onAdd={noop} onDragStart={noop} onDragEnd={noop} onDrop={noop} />
            <Column status="in-progress" cards={[SAMPLE_CARDS[1]]} draggingId={null} newCardId={null} filtered={false} onOpen={noop} onAdd={noop} onDragStart={noop} onDragEnd={noop} onDrop={noop} />
            <Column status="in-review" cards={[]} draggingId={null} newCardId={null} filtered={false} onOpen={noop} onAdd={noop} onDragStart={noop} onDragEnd={noop} onDrop={noop} />
            <section className="column column--done column--over" aria-label="Done, drop target example">
              <header className="column__header">
                <h2>Done</h2>
                <span className="column__count">0</span>
              </header>
              <div className="column__cards">
                <p className="column__empty">No cards</p>
              </div>
            </section>
          </div>
        </div>
        <p className="ds-muted">Populated with an “Add card” button (Backlog), populated, empty, and highlighted as a drop target.</p>
        <ul className="ds-list">
          <li>Four fixed columns: Backlog, In Progress, In Review, Done. Each has a tint, a heading and a count; only Backlog has the “Add card” button.</li>
          <li>Dropping on a card inserts before it; dropping on empty space adds to the end of that column.</li>
        </ul>
      </Sub>

      <Sub title="Form fields">
        <div className="ds-demo ds-fields">
          <label className="field">
            <span>Title</span>
            <input defaultValue="Retile the bathroom" />
          </label>
          <label className="field">
            <span>Priority</span>
            <select defaultValue="Medium">
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <input aria-invalid="true" aria-describedby="ds-err" />
            <span id="ds-err" className="field__error">Assignee is required</span>
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" aria-describedby="ds-hint" />
            <span id="ds-hint" className="field__hint">At least 8 characters.</span>
          </label>
          <label className="field ds-fields__wide">
            <span>Description</span>
            <textarea rows={3} placeholder="Notes, links, anything worth remembering…" />
          </label>
        </div>
        <ul className="ds-list">
          <li>Every input has a <strong>visible label above it</strong>, written as the wrapping <code>label.field</code>, so the label is also the click target. Placeholders are examples, never labels.</li>
          <li>Errors appear under the field in <code>--danger</code>, the outline turns <code>--danger</code>, and the input points to the message with <code>aria-describedby</code> and <code>aria-invalid</code>.</li>
          <li>Hints use <code>field__hint</code> in muted text.</li>
        </ul>
      </Sub>

      <Sub title="Notices and states">
        <div className="ds-demo">
          <div className="notice" style={{ margin: 0 }}>
            <p>We found 3 cards on 2 boards saved in this browser. Add them to your account?</p>
            <div className="notice__actions">
              <button type="button" className="btn btn--primary btn--small">Import</button>
              <button type="button" className="btn btn--small">No thanks</button>
            </div>
          </div>
          <div className="notice notice--error" style={{ margin: '12px 0 0' }}>
            <p>That change couldn’t be saved (network error). Your boards were reloaded from your account.</p>
            <button type="button" className="btn btn--small">Dismiss</button>
          </div>
          <div className="state ds-state">
            <p>Couldn’t load your boards: network error</p>
            <button type="button" className="btn btn--primary">Try again</button>
          </div>
        </div>
        <ul className="ds-list">
          <li><strong>Info notice</strong> (<code>notice</code>, In Review blue): optional, dismissible offers.</li>
          <li><strong>Error notice</strong> (<code>notice notice--error</code>, Backlog pink): something didn’t save. Says what happened and what the app did about it.</li>
          <li><strong>State block</strong> (<code>state</code>): centered, full-width message for loading and load errors, with a retry button.</li>
        </ul>
      </Sub>

      <Sub title="Dialogs and the side panel">
        <div className="ds-demo ds-row">
          <button type="button" className="btn" onClick={() => setDialog('modal')}>Open a dialog</button>
          <button type="button" className="btn" onClick={() => setDialog('panel')}>Open the side panel</button>
        </div>
        <ul className="ds-list">
          <li><strong>Dialog</strong> (<code>Dialog</code> with class <code>modal</code>): short, focused tasks: create a card, create or rename a board. Centered, with a dimmed and blurred backdrop.</li>
          <li><strong>Side panel</strong> (<code>Dialog</code> with class <code>panel</code>): looking at and editing one thing in full, with the board still visible behind it. Sticky header with a Close button; content scrolls.</li>
          <li>Both are native <code>&lt;dialog&gt;</code> elements opened with <code>showModal()</code>, so focus is trapped, <kbd>Esc</kbd> closes, and focus returns to where it came from. Mark the field to focus first with <code>data-autofocus</code>.</li>
          <li>Content mounts only while open, so every open starts with a clean form.</li>
        </ul>

        <Dialog open={dialog === 'modal'} onClose={() => setDialog(null)} labelledBy="ds-modal-title" className="modal">
          <div className="sheet">
            <h2 id="ds-modal-title">Example dialog</h2>
            <p>A dialog holds one short task. It ends with a quiet Cancel and one primary action.</p>
            <div className="form__actions">
              <span className="form__spacer" />
              <button type="button" className="btn" onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className="btn btn--primary" onClick={() => setDialog(null)}>Done</button>
            </div>
          </div>
        </Dialog>

        <Dialog open={dialog === 'panel'} onClose={() => setDialog(null)} labelledBy="ds-panel-title" className="panel">
          <header className="panel__header">
            <h2 id="ds-panel-title">Card details</h2>
            <button type="button" className="btn" onClick={() => setDialog(null)}>Close</button>
          </header>
          <div className="sheet">
            <CardForm card={SAMPLE_CARDS[0]} submitLabel="Save changes" requireChanges onSave={noop} onDelete={noop} />
          </div>
        </Dialog>
      </Sub>

      <Sub title="Header and account">
        <p>
          The header holds the app name, the page links and the signed-in email with a small “Sign out”
          button. On narrow screens it wraps; the email truncates with an ellipsis before anything else
          gives way.
        </p>
      </Sub>
    </Section>
  )
}
