import { useRef, useState, type FormEvent } from 'react'
import type { Board } from '../types'
import { Dialog } from './Dialog'

const MAX_NAME_LENGTH = 30

interface BoardModalProps {
  /** null = closed; a board = renaming; 'new' = creating */
  target: Board | 'new' | null
  /** Cards that would be deleted along with the board being edited. */
  cardCount: number
  canDelete: boolean
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function BoardModal({ target, onClose, ...rest }: BoardModalProps) {
  return (
    <Dialog open={target !== null} onClose={onClose} labelledBy="board-modal-title" className="modal">
      {target && (
        <BoardForm key={target === 'new' ? 'new' : target.id} target={target} onCancel={onClose} {...rest} />
      )}
    </Dialog>
  )
}

interface BoardFormProps extends Omit<BoardModalProps, 'target' | 'onClose'> {
  target: Board | 'new'
  onCancel: () => void
}

function BoardForm({ target, cardCount, canDelete, onCreate, onRename, onDelete, onCancel }: BoardFormProps) {
  const editing = target === 'new' ? null : target
  const [name, setName] = useState(editing?.name ?? '')
  const [showError, setShowError] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const nameError = name.trim() ? null : 'Board name is required'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (nameError) {
      setShowError(true)
      nameRef.current?.focus()
      return
    }
    if (editing) onRename(editing.id, name.trim())
    else onCreate(name.trim())
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="sheet">
      <h2 id="board-modal-title">{editing ? 'Edit board' : 'New board'}</h2>

      <label className="field">
        <span id="board-name-label">Board name</span>
        <input
          ref={nameRef}
          aria-labelledby="board-name-label"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder="Work, Home, Hobbies…"
          data-autofocus=""
          aria-invalid={showError && !!nameError}
          aria-describedby={showError && nameError ? 'board-name-error' : undefined}
        />
        {showError && nameError && (
          <span id="board-name-error" className="field__error" role="alert">{nameError}</span>
        )}
      </label>

      {confirmingDelete && editing ? (
        <div className="form__confirm" role="alert">
          <p>
            Delete “{editing.name}” and {cardCount === 1 ? 'its 1 card' : `its ${cardCount} cards`}?
            This can’t be undone.
          </p>
          <div className="form__actions">
            <button type="button" className="btn btn--danger" onClick={() => onDelete(editing.id)}>
              Yes, delete board
            </button>
            {/* The safe choice gets focus, since the button that was clicked has just gone. */}
            <button
              type="button"
              className="btn"
              autoFocus
              onClick={() => {
                setConfirmingDelete(false)
                // Put focus back on "Delete board" once it has re-rendered.
                window.requestAnimationFrame(() => deleteRef.current?.focus())
              }}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="form__actions">
          {editing && canDelete && (
            <button
              ref={deleteRef}
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete board
            </button>
          )}
          <span className="form__spacer" />
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Save' : 'Create board'}
          </button>
        </div>
      )}
    </form>
  )
}
