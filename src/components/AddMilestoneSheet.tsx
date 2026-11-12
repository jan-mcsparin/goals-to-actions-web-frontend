import { useId, useState } from 'react'
import { parsedMilestone, type DateRange, type MilestoneDraft } from '../domain/goalDetail.ts'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type AddMilestoneSheetProps = {
  open: boolean
  // "milestone", or "step" on a one-off goal.
  noun: 'milestone' | 'step'
  // From the goal's start to its deadline.
  dateRange?: DateRange
  onSave: (draft: MilestoneDraft) => void
  onClose: () => void
}

// The fields live inside only while the sheet is open, so each opening starts empty.
export function AddMilestoneSheet({ open, noun, dateRange, onSave, onClose }: AddMilestoneSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{`Add ${noun}`}</h2>
      </header>
      {open && dateRange && <MilestoneForm dateRange={dateRange} onSave={onSave} onCancel={onClose} />}
    </dialog>
  )
}

type MilestoneFormProps = {
  dateRange: DateRange
  onSave: (draft: MilestoneDraft) => void
  onCancel: () => void
}

function MilestoneForm({ dateRange, onSave, onCancel }: MilestoneFormProps) {
  const [measurableLine, setMeasurableLine] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const lineId = useId()
  const dateId = useId()
  const draft = { measurableLine, targetDate }
  const canSave = parsedMilestone(draft, { startDate: dateRange.min, deadline: dateRange.max }) !== undefined

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
        min={dateRange.min}
        max={dateRange.max}
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
