import { useId, useState } from 'react'
import { parsedTarget, type TargetDraft } from '../domain/goalDetail.ts'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type TargetSheetProps = {
  open: boolean
  initial?: TargetDraft
  onSave: (draft: TargetDraft) => void
  onClose: () => void
}

// The fields live inside only while the sheet is open, so each opening starts
// from the target in force.
export function TargetSheet({ open, initial, onSave, onClose }: TargetSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Weekly target</h2>
      </header>
      {open && initial && <TargetForm initial={initial} onSave={onSave} onCancel={onClose} />}
    </dialog>
  )
}

type TargetFormProps = {
  initial: TargetDraft
  onSave: (draft: TargetDraft) => void
  onCancel: () => void
}

function TargetForm({ initial, onSave, onCancel }: TargetFormProps) {
  const [sessions, setSessions] = useState(initial.sessions)
  const [unit, setUnit] = useState(initial.unit)
  const sessionsId = useId()
  const unitId = useId()
  const canSave = parsedTarget({ sessions, unit }) !== undefined

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave({ sessions, unit })
      }}
    >
      <label htmlFor={sessionsId}>Amount</label>
      <input
        id={sessionsId}
        value={sessions}
        inputMode="numeric"
        autoComplete="off"
        required
        onChange={(event) => setSessions(event.target.value)}
      />

      <label htmlFor={unitId}>Unit</label>
      <input
        id={unitId}
        value={unit}
        placeholder="sessions, runs, pages…"
        autoComplete="off"
        required
        onChange={(event) => setUnit(event.target.value)}
      />

      <p className="edit-form-note">A week, starting this week.</p>

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
