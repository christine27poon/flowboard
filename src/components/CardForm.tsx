import { useId, useRef, useState, type FormEvent } from 'react'
import {
  PRIORITIES,
  STATUSES,
  STATUS_LABELS,
  type Card,
  type CardDraft,
  type Priority,
  type Status,
} from '../types'

interface CardFormProps {
  /** The card being edited, or null to create a new one. */
  card: Card | null
  submitLabel: string
  /** Column preselected for a new card. */
  defaultStatus?: Status
  /** Keep the submit button disabled until a field changes (for the side panel). */
  requireChanges?: boolean
  /** May return whether the server accepted the change, so the form can report it truthfully. */
  onSave: (draft: CardDraft) => void | Promise<boolean>
  onDelete?: () => void
  onCancel?: () => void
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function CardForm({
  card,
  submitLabel,
  defaultStatus,
  requireChanges,
  onSave,
  onDelete,
  onCancel,
}: CardFormProps) {
  const uid = useId()
  const [title, setTitle] = useState(card?.title ?? '')
  const [assignee, setAssignee] = useState(card?.assignee ?? '')
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'Medium')
  const [dueDate, setDueDate] = useState(card?.dueDate ?? today())
  const [status, setStatus] = useState<Status>(card?.status ?? defaultStatus ?? 'backlog')
  const [description, setDescription] = useState(card?.description ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const latestSave = useRef(0)
  const titleRef = useRef<HTMLInputElement>(null)
  const assigneeRef = useRef<HTMLInputElement>(null)
  const dueRef = useRef<HTMLInputElement>(null)

  const titleError = title.trim() ? null : 'Title is required'
  const assigneeError = assignee.trim() ? null : 'Assignee is required'
  const dueError = dueDate ? null : 'Due date is required'

  const dirty =
    !card ||
    title !== card.title ||
    assignee !== card.assignee ||
    priority !== card.priority ||
    dueDate !== card.dueDate ||
    status !== card.status ||
    description !== card.description

  /** Wrap a setter so editing any field clears the "Saved" note. */
  function edit<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setSaveState('idle')
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (titleError || assigneeError || dueError) {
      setShowErrors(true)
      // Send people to the first problem so they don't have to hunt for it.
      const first = titleError ? titleRef : assigneeError ? assigneeRef : dueRef
      first.current?.focus()
      return
    }
    const trimmedTitle = title.trim()
    const trimmedAssignee = assignee.trim()
    const result = onSave({
      title: trimmedTitle,
      assignee: trimmedAssignee,
      priority,
      dueDate,
      status,
      description,
    })
    setTitle(trimmedTitle)
    setAssignee(trimmedAssignee)
    if (!result) return
    // The screen already shows the change; only call it saved once the server agrees.
    const mine = ++latestSave.current
    setSaveState('saving')
    void result.then((ok) => {
      if (mine === latestSave.current) setSaveState(ok ? 'saved' : 'failed')
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      <label className="field">
        <span id={`${uid}-title-label`}>Title</span>
        <input
          ref={titleRef}
          aria-labelledby={`${uid}-title-label`}
          value={title}
          maxLength={200}
          onChange={(e) => edit(setTitle)(e.target.value)}
          data-autofocus={card ? undefined : ''}
          aria-invalid={showErrors && !!titleError}
          aria-describedby={showErrors && titleError ? `${uid}-title` : undefined}
        />
        {showErrors && titleError && (
          <span id={`${uid}-title`} className="field__error" role="alert">{titleError}</span>
        )}
      </label>

      <label className="field">
        <span id={`${uid}-assignee-label`}>Assignee</span>
        <input
          ref={assigneeRef}
          aria-labelledby={`${uid}-assignee-label`}
          value={assignee}
          maxLength={100}
          onChange={(e) => edit(setAssignee)(e.target.value)}
          aria-invalid={showErrors && !!assigneeError}
          aria-describedby={showErrors && assigneeError ? `${uid}-assignee` : undefined}
        />
        {showErrors && assigneeError && (
          <span id={`${uid}-assignee`} className="field__error" role="alert">{assigneeError}</span>
        )}
      </label>

      <div className="form__row">
        <label className="field">
          <span>Priority</span>
          <select value={priority} onChange={(e) => edit(setPriority)(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span id={`${uid}-due-label`}>Due date</span>
          <input
            ref={dueRef}
            aria-labelledby={`${uid}-due-label`}
            type="date"
            value={dueDate}
            onChange={(e) => edit(setDueDate)(e.target.value)}
            aria-invalid={showErrors && !!dueError}
            aria-describedby={showErrors && dueError ? `${uid}-due` : undefined}
          />
          {showErrors && dueError && (
            <span id={`${uid}-due`} className="field__error" role="alert">{dueError}</span>
          )}
        </label>
      </div>

      <label className="field">
        <span>Column</span>
        <select value={status} onChange={(e) => edit(setStatus)(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          rows={6}
          maxLength={10000}
          value={description}
          onChange={(e) => edit(setDescription)(e.target.value)}
          placeholder="Notes, links, anything worth remembering…"
        />
      </label>

      {saveState === 'failed' && (
        <p className="field__error" role="alert">
          That change couldn’t be saved, so it was undone. Please try again.
        </p>
      )}

      <div className="form__actions">
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="form__spacer" role="status">
          {saveState === 'saved' && !dirty ? 'Saved ✓' : saveState === 'saving' ? 'Saving…' : ''}
        </span>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={requireChanges && !dirty}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
