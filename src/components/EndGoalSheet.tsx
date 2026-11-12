import { useId } from 'react'
import type { Started } from '../domain/goalDetail.ts'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type EndGoalSheetProps = {
  open: boolean
  started?: Started
  // "2 of 6 milestones hit".
  achievement: string
  onEnd: (outcome: 'reached' | 'ended') => void
  onClose: () => void
}

// Leads with what was achieved, then asks which it is: only the person can
// tell whether the goal was crossed.
export function EndGoalSheet({ open, started, achievement, onEnd, onClose }: EndGoalSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>End goal</h2>
      </header>
      {open && (
        <div className="edit-form">
          {started && <p className="edit-form-note">{started.startedAt}</p>}
          {started?.latest && <p className="edit-form-note">{started.latest}</p>}
          <p className="edit-form-note">{achievement}</p>
          <div className="edit-form-actions end-goal-actions">
            <button type="button" className="edit-form-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="edit-form-cancel" onClick={() => onEnd('ended')}>
              End it for now
            </button>
            <button type="button" className="edit-form-save" onClick={() => onEnd('reached')}>
              I reached it
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
