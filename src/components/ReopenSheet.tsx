import { useId, useState } from 'react'
import { parsedReopen, type DateRange, type MilestoneDraft, type ReopenChanges } from '../domain/goalDetail.ts'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type ReopenSheetProps = {
  open: boolean
  // Move the date asks only for a date; Adjust asks for the line and a date.
  mode: 'move' | 'adjust'
  noun: 'milestone' | 'step'
  initial: MilestoneDraft
  dateRange?: DateRange
  onSave: (changes: ReopenChanges) => void
  onClose: () => void
}

// The fields live inside only while the sheet is open, so each opening starts
// from the milestone as it is.
export function ReopenSheet({ open, mode, noun, initial, dateRange, onSave, onClose }: ReopenSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{mode === 'move' ? 'Move the date' : `Adjust the ${noun}`}</h2>
      </header>
      {open && dateRange && (
        <ReopenForm
          mode={mode}
          pushesLater={noun === 'milestone'}
          initial={initial}
          dateRange={dateRange}
          onSave={onSave}
          onCancel={onClose}
        />
      )}
    </dialog>
  )
}

type ReopenFormProps = {
  mode: 'move' | 'adjust'
  // A milestone's later ones move with it; a one-off goal's steps don't.
  pushesLater: boolean
  initial: MilestoneDraft
  dateRange: DateRange
  onSave: (changes: ReopenChanges) => void
  onCancel: () => void
}

function ReopenForm({ mode, pushesLater, initial, dateRange, onSave, onCancel }: ReopenFormProps) {
  const [measurableLine, setMeasurableLine] = useState(initial.measurableLine)
  const [targetDate, setTargetDate] = useState(initial.targetDate)
  const lineId = useId()
  const dateId = useId()
  const changes = parsedReopen(mode, { measurableLine, targetDate }, { startDate: dateRange.min, deadline: dateRange.max })

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (changes) onSave(changes)
      }}
    >
      {mode === 'adjust' && (
        <>
          <label htmlFor={lineId}>Measurable line</label>
          <input
            id={lineId}
            value={measurableLine}
            autoComplete="off"
            required
            onChange={(event) => setMeasurableLine(event.target.value)}
          />
        </>
      )}

      <label htmlFor={dateId}>{mode === 'move' ? 'New date' : 'Date (optional)'}</label>
      <input
        id={dateId}
        type="date"
        value={targetDate}
        min={dateRange.min}
        max={dateRange.max}
        required={mode === 'move'}
        onChange={(event) => setTargetDate(event.target.value)}
      />
      {pushesLater && <p className="edit-form-note">Later milestones move by the same amount, up to the deadline.</p>}

      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="edit-form-save" disabled={!changes}>
          Save
        </button>
      </div>
    </form>
  )
}
