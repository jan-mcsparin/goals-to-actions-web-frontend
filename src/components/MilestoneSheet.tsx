import { useId } from 'react'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type MilestoneSheetProps = {
  open: boolean
  title?: string
  noun: 'milestone' | 'step'
  // Next, or any step not done on a one-off goal.
  canCheckIn: boolean
  onCheckIn: () => void
  onDelete: () => void
  onClose: () => void
}

// What a milestone row opens: Check in when it can be, and Delete, last and set apart.
export function MilestoneSheet({ open, title, noun, canCheckIn, onCheckIn, onDelete, onClose }: MilestoneSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      {canCheckIn && (
        <div className="edit-form-actions sheet-actions">
          <button type="button" className="edit-form-save" onClick={onCheckIn}>
            Check in
          </button>
        </div>
      )}
      <button type="button" className="sheet-delete" onClick={onDelete}>
        {`Delete ${noun}`}
      </button>
    </dialog>
  )
}
