import { Section, Sub } from './Section'

export function AccessibilitySection() {
  return (
    <Section
      id="accessibility"
      title="Accessibility"
      intro="The target is WCAG 2.2 AA. This is what the design system builds in, and what it doesn’t cover yet."
    >
      <Sub title="Built in">
        <ul className="ds-list">
          <li><strong>Contrast:</strong> all text pairs meet 4.5:1 and form-field outlines and the focus ring meet 3:1, in both themes (see the live table under Color).</li>
          <li><strong>Keyboard:</strong> everything works without a mouse. A visible focus ring (<code>:focus-visible</code>) is on every interactive element. Cards open with their “Open” button. Dragging is never the only way: the card panel has Move up / Move down buttons and a Column field.</li>
          <li><strong>Touch targets:</strong> 44px minimum on touch screens (<code>@media (any-pointer: coarse)</code>); every target is at least 24px everywhere (WCAG 2.5.8).</li>
          <li><strong>Structure:</strong> one <code>h1</code>; heading levels that nest (board name, then columns, then cards); labeled <code>nav</code> landmarks (“Pages”, “Breadcrumb”); a labeled <code>main</code> region; lists for links, cards and board tiles; <code>aria-current</code> for the current page and board.</li>
          <li><strong>Forms:</strong> visible labels; errors written next to the field, tied to it with <code>aria-describedby</code> and <code>aria-invalid</code>, announced with <code>role="alert"</code>, and focus moves to the first field that needs fixing. Placeholders meet 4.5:1.</li>
          <li><strong>Announcements:</strong> adding, moving, deleting and restoring cards, and creating, renaming and deleting boards, are spoken through a polite live region (inside the dialog while one is open, because a modal makes the rest of the page inert). “Saved ✓” appears only after the server confirms; failures use <code>role="alert"</code>.</li>
          <li><strong>Dialogs:</strong> native <code>&lt;dialog&gt;</code> gives focus trapping, <kbd>Esc</kbd> to close and focus restoration, each labeled by its heading (the card panel includes the card’s title). The panel keeps a focused field clear of its sticky header.</li>
          <li><strong>Focus is never dropped:</strong> when the control you used disappears (delete confirmation, clearing filters, the switcher, the import banner, deleting a card), focus moves to the next sensible place.</li>
          <li><strong>Deleting is reversible:</strong> deleting a card shows an “Undo” message that takes focus and stays until you act on it or move away (WCAG 3.3.4).</li>
          <li><strong>Motion:</strong> reduced-motion preference turns off every transition and animation.</li>
          <li><strong>Not by color alone:</strong> priority, overdue and errors are always also written out.</li>
          <li><strong>Resize:</strong> type is in <code>rem</code>, layouts reflow down to 320px, and the page doesn’t scroll sideways.</li>
          <li><strong>Themes:</strong> the page declares <code>color-scheme: light dark</code> so native controls follow the theme, and a <code>forced-colors</code> block keeps the progress bar, new-card highlight and current board visible in high-contrast modes.</li>
        </ul>
      </Sub>

      <Sub title="Known gaps">
        <p>Worth knowing before relying on it:</p>
        <ul className="ds-list">
          <li>Drag and drop uses the browser’s native drag, which works with a mouse but is unreliable on touch screens. On touch screens and with the keyboard, use the Move up / Move down buttons and the Column field in the card panel.</li>
          <li>Closing the side panel discards unsaved edits without asking.</li>
          <li>Screen-reader and real-device testing have not been done beyond automated checks and code review.</li>
          <li>There is no manual light/dark switch.</li>
        </ul>
      </Sub>

      <Sub title="Checklist for new work">
        <ul className="ds-list ds-checklist">
          <li>Can I do it with the keyboard alone, and can I see where focus is?</li>
          <li>Does every input have a visible label, and every error a message?</li>
          <li>Do new colors pass in the contrast table, in both themes?</li>
          <li>Is meaning carried by words or shape as well as color?</li>
          <li>Is the touch target at least 44px, and does it work at 375px wide?</li>
          <li>Does it have loading, empty and error states?</li>
          <li>Does the copy stay warm and neutral?</li>
        </ul>
      </Sub>
    </Section>
  )
}
