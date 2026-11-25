import { useId } from 'react'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type DeleteSheetProps = {
  open: boolean
  // What it asks, naming the thing and what goes with it (domain/deleting.ts).
  question: string
  onDelete: () => void
  onClose: () => void
}

// Asks once before deleting. Cancel comes first and takes the focus, so Delete is never the
// default; Delete is plain, never a red button.
export function DeleteSheet({ open, question, onDelete, onClose }: DeleteSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{question}</h2>
      </header>
      <div className="edit-form-actions sheet-actions">
        <button type="button" className="edit-form-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="edit-form-save" onClick={onDelete}>
          Delete
        </button>
      </div>
    </dialog>
  )
}
