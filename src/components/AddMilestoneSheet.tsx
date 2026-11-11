import { useId, useState } from 'react'
import { parsedMilestone, type MilestoneDraft } from '../domain/goalDetail.ts'
import './editForm.css'
import './sheet.css'
import { useModalDialog } from './useModalDialog.ts'

type AddMilestoneSheetProps = {
  open: boolean
  // "milestone", or "step" on a one-off goal.
  noun: 'milestone' | 'step'
  // The latest date a milestone can have.
  deadline?: string
  onSave: (draft: MilestoneDraft) => void
  onClose: () => void
}

// The fields live inside only while the sheet is open, so each opening starts empty.
export function AddMilestoneSheet({ open, noun, deadline, onSave, onClose }: AddMilestoneSheetProps) {
  const dialog = useModalDialog(open)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{`Add ${noun}`}</h2>
      </header>
      {open && <MilestoneForm deadline={deadline} onSave={onSave} onCancel={onClose} />}
    </dialog>
  )
}

type MilestoneFormProps = {
  deadline?: string
  onSave: (draft: MilestoneDraft) => void
  onCancel: () => void
}

function MilestoneForm({ deadline, onSave, onCancel }: MilestoneFormProps) {
  const [measurableLine, setMeasurableLine] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const lineId = useId()
  const dateId = useId()
  const draft = { measurableLine, targetDate }
  const canSave = parsedMilestone(draft, { deadline }) !== undefined

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave(draft)
      }}
    >
      <label htmlFor={lineId}>Measurable line</label>
      <input
        id={lineId}
        value={measurableLine}
        autoComplete="off"
        required
        onChange={(event) => setMeasurableLine(event.target.value)}
      />

      <label htmlFor={dateId}>Date (optional)</label>
      <input
        id={dateId}
        type="date"
        value={targetDate}
        max={deadline}
        onChange={(event) => setTargetDate(event.target.value)}
      />

      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="edit-form-save" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  )
}
