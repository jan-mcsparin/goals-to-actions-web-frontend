import { useId, useState } from 'react'
import './editForm.css'
import './sheet.css'
import { useModalDialog } from './useModalDialog.ts'

type CheckInSheetProps = {
  open: boolean
  // The milestone's (or the goal's) measurable line, as the title.
  title?: string
  // A one-off goal's steps read Done instead of Hit it.
  doneLabel: 'Hit it' | 'Done'
  onCheckIn: (outcome: 'hit' | 'notYet', result: string) => void
  onClose: () => void
}

// The result field lives inside only while the sheet is open, so each
// check-in starts empty.
export function CheckInSheet({ open, title, doneLabel, onCheckIn, onClose }: CheckInSheetProps) {
  const dialog = useModalDialog(open)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
      </header>
      {open && <CheckInForm doneLabel={doneLabel} onCheckIn={onCheckIn} onCancel={onClose} />}
    </dialog>
  )
}

type CheckInFormProps = {
  doneLabel: 'Hit it' | 'Done'
  onCheckIn: (outcome: 'hit' | 'notYet', result: string) => void
  onCancel: () => void
}

function CheckInForm({ doneLabel, onCheckIn, onCancel }: CheckInFormProps) {
  const [result, setResult] = useState('')
  const resultId = useId()

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        onCheckIn('hit', result)
      }}
    >
      <p className="edit-form-note">How did it go?</p>
      <label htmlFor={resultId}>Result (optional)</label>
      <input
        id={resultId}
        value={result}
        autoComplete="off"
        placeholder="Bench 155, squat 300, deadlift 345"
        onChange={(event) => setResult(event.target.value)}
      />

      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="edit-form-cancel" onClick={() => onCheckIn('notYet', result)}>
          Not yet
        </button>
        <button type="submit" className="edit-form-save">
          {doneLabel}
        </button>
      </div>
    </form>
  )
}
