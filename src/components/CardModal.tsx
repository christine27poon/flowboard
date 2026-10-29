import type { CardDraft, Status } from '../types'
import { CardForm } from './CardForm'
import { Dialog } from './Dialog'

interface CardModalProps {
  open: boolean
  /** Column the new card starts in. */
  status: Status
  onSave: (draft: CardDraft) => void
  onClose: () => void
}

/** Quick "new card" form. Existing cards are edited in the side panel. */
export function CardModal({ open, status, onSave, onClose }: CardModalProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="card-modal-title" className="modal">
      <div className="sheet">
        <h2 id="card-modal-title">New card</h2>
        <CardForm
          card={null}
          defaultStatus={status}
          submitLabel="Add card"
          onSave={onSave}
          onCancel={onClose}
        />
      </div>
    </Dialog>
  )
}
