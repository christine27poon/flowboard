/** Documentation data for the design system page. Colors are read live from the CSS tokens. */

export interface ColorToken {
  name: string
  role: string
}

export const COLOR_GROUPS: { title: string; blurb: string; tokens: ColorToken[] }[] = [
  {
    title: 'Surfaces and lines',
    blurb: 'The quiet backdrop. Everything else sits on these.',
    tokens: [
      { name: '--bg', role: 'Page canvas and the fill of form fields' },
      { name: '--surface', role: 'Cards, board tiles, dialogs, side panel and buttons' },
      { name: '--border', role: 'Card, dialog and panel outlines, dividers (decorative)' },
      { name: '--border-strong', role: 'Hover outline on buttons and the board switcher' },
      { name: '--control-border', role: 'Outline of form fields (3:1 or better)' },
    ],
  },
  {
    title: 'Text',
    blurb: 'Two levels are enough: what to read, and what to glance at.',
    tokens: [
      { name: '--text', role: 'Titles, body copy, labels, input text' },
      { name: '--text-muted', role: 'Hints, counts, empty states, card descriptions and meta' },
    ],
  },
  {
    title: 'Action and feedback',
    blurb: 'One accent for “do this”, one warm rose for “careful”.',
    tokens: [
      { name: '--accent', role: 'Primary buttons, current tab, focus ring, drop-target outline' },
      { name: '--accent-text', role: 'Label color on top of --accent' },
      { name: '--danger', role: 'Delete buttons, error text, overdue dates, invalid field outline' },
    ],
  },
  {
    title: 'Column tints',
    blurb: 'Each stage of work has its own pastel, so columns read at a glance.',
    tokens: [
      { name: '--backlog', role: 'Backlog column (also the error notice and delete confirmation)' },
      { name: '--in-progress', role: 'In Progress column' },
      { name: '--in-review', role: 'In Review column (also the info notice)' },
      { name: '--done', role: 'Done column' },
    ],
  },
  {
    title: 'Priority badges',
    blurb: 'Each badge is a tint plus a darker text color from the same family.',
    tokens: [
      { name: '--high', role: 'High priority badge fill' },
      { name: '--high-text', role: 'High priority badge label' },
      { name: '--medium', role: 'Medium priority badge fill' },
      { name: '--medium-text', role: 'Medium priority badge label' },
      { name: '--low', role: 'Low priority badge fill' },
      { name: '--low-text', role: 'Low priority badge label' },
    ],
  },
]

export interface ContrastPair {
  label: string
  fg: string
  bg: string
  /** Required ratio: 4.5 for text, 3 for UI boundaries and focus indicators. */
  min: 4.5 | 3
  kind: 'Text' | 'UI'
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { label: 'Body text on page', fg: '--text', bg: '--bg', min: 4.5, kind: 'Text' },
  { label: 'Body text on cards and dialogs', fg: '--text', bg: '--surface', min: 4.5, kind: 'Text' },
  { label: 'Muted text on cards and dialogs', fg: '--text-muted', bg: '--surface', min: 4.5, kind: 'Text' },
  { label: 'Muted text on page', fg: '--text-muted', bg: '--bg', min: 4.5, kind: 'Text' },
  { label: 'Muted text on Backlog tint', fg: '--text-muted', bg: '--backlog', min: 4.5, kind: 'Text' },
  { label: 'Muted text on In Progress tint', fg: '--text-muted', bg: '--in-progress', min: 4.5, kind: 'Text' },
  { label: 'Muted text on In Review tint', fg: '--text-muted', bg: '--in-review', min: 4.5, kind: 'Text' },
  { label: 'Muted text on Done tint', fg: '--text-muted', bg: '--done', min: 4.5, kind: 'Text' },
  { label: 'Primary button and current tab label', fg: '--accent-text', bg: '--accent', min: 4.5, kind: 'Text' },
  { label: 'Accent text on cards and dialogs', fg: '--accent', bg: '--surface', min: 4.5, kind: 'Text' },
  { label: 'Error text and overdue dates', fg: '--danger', bg: '--surface', min: 4.5, kind: 'Text' },
  { label: 'High priority badge', fg: '--high-text', bg: '--high', min: 4.5, kind: 'Text' },
  { label: 'Medium priority badge', fg: '--medium-text', bg: '--medium', min: 4.5, kind: 'Text' },
  { label: 'Low priority badge', fg: '--low-text', bg: '--low', min: 4.5, kind: 'Text' },
  { label: 'Form field outline on field fill', fg: '--control-border', bg: '--bg', min: 3, kind: 'UI' },
  { label: 'Form field outline on cards and dialogs', fg: '--control-border', bg: '--surface', min: 3, kind: 'UI' },
  { label: 'Focus ring on page', fg: '--accent', bg: '--bg', min: 3, kind: 'UI' },
  { label: 'Focus ring on cards and dialogs', fg: '--accent', bg: '--surface', min: 3, kind: 'UI' },
]

export interface TypeStyle {
  name: string
  size: string
  px: number
  weight: number
  usage: string
  sample: string
}

export const TYPE_SCALE: TypeStyle[] = [
  { name: 'Title', size: '1.75rem', px: 28, weight: 800, usage: 'App name in the header, sign-in card', sample: 'Team Board' },
  { name: 'Dialog heading', size: '1.25rem', px: 20, weight: 800, usage: 'New card, New board, Edit board', sample: 'New card' },
  { name: 'Panel heading', size: '1.125rem', px: 18, weight: 800, usage: 'Side panel header', sample: 'Card details' },
  { name: 'Column heading', size: '1.0625rem', px: 17, weight: 800, usage: 'Backlog, In Progress, In Review, Done', sample: 'In Progress' },
  { name: 'Card title', size: '1rem', px: 16, weight: 700, usage: 'Titles on cards', sample: 'Retile the bathroom' },
  { name: 'Body', size: '1rem', px: 16, weight: 400, usage: 'Default text, input values, page descriptions', sample: 'Notes, links, anything worth remembering' },
  { name: 'Label', size: '0.875rem', px: 14, weight: 600, usage: 'Field labels, “Saved ✓”, signed-in email', sample: 'Assignee' },
  { name: 'Caption', size: '0.8125rem', px: 13, weight: 600, usage: 'Card meta, descriptions, counts, small buttons', sample: 'Due Jan 5, 2030' },
  { name: 'Badge', size: '0.75rem', px: 12, weight: 700, usage: 'Priority badges', sample: 'High' },
]

export const SPACING_STEPS: { px: number; usage: string }[] = [
  { px: 4, usage: 'Label to input; between page tabs' },
  { px: 6, usage: 'Padding around the board tab list (leaves room for the focus ring)' },
  { px: 8, usage: 'Between buttons, tabs, chips and a column header’s items' },
  { px: 10, usage: 'Between cards in a column; textarea padding' },
  { px: 12, usage: 'Card and column padding; gap between a column’s header and cards' },
  { px: 14, usage: 'Between form fields and dialog sections' },
  { px: 16, usage: 'Gap between columns; vertical padding of the header' },
  { px: 20, usage: 'Page gutter; dialog and panel padding' },
  { px: 24, usage: 'Space under the board' },
  { px: 40, usage: 'Vertical padding of full-width loading and error messages' },
]

export const RADII: { px: string; usage: string }[] = [
  { px: '12px', usage: 'Columns (the --radius token), dialogs, side panel (left corners), sign-in card' },
  { px: '8px', usage: 'Buttons, tabs, cards, notices, delete confirmation' },
  { px: '6px', usage: 'Badges, count chips, form fields, code blocks' },
]
