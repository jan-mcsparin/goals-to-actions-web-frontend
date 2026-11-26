import { useId, useState } from 'react'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type MoveSheetProps = {
  open: boolean
  taskTitle?: string
  // The task's day now, and the first day it can go to.
  from?: string
  min?: string
  onMove: (day: string) => void
  onClose: () => void
}

// Moves a set item to another day, in any week (spec 082): the native date input, as the Add
// sheet's Day. Move is on once the day differs.
export function MoveSheet({ open, taskTitle, from, min, onMove, onClose }: MoveSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Move to another day</h2>
      </header>
      {open && from && <MoveForm key={from} taskTitle={taskTitle} from={from} min={min} onMove={onMove} onCancel={onClose} />}
    </dialog>
  )
}

type MoveFormProps = {
  taskTitle?: string
  from: string
  min?: string
  onMove: (day: string) => void
  onCancel: () => void
}

function MoveForm({ taskTitle, from, min, onMove, onCancel }: MoveFormProps) {
  const [day, setDay] = useState(from)
  const dayId = useId()
  const ready = day !== '' && day !== from && (!min || day >= min)

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) onMove(day)
      }}
    >
      {taskTitle && <p className="edit-form-note">{taskTitle}</p>}
      <label htmlFor={dayId}>Day</label>
      <input id={dayId} type="date" value={day} min={min} required onChange={(event) => setDay(event.target.value)} />
      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="edit-form-save" disabled={!ready}>
          Move
        </button>
      </div>
    </form>
  )
}
