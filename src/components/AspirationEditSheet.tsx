import { useId, useState } from 'react'
import { canSaveName } from '../domain/aspiration.ts'
import type { NameAndWhy } from '../hooks/useAspiration.ts'
import './sheet.css'
import './AspirationEditSheet.css'
import { useModalDialog } from './useModalDialog.ts'

type AspirationEditSheetProps = {
  open: boolean
  initial?: NameAndWhy
  onSave: (changes: NameAndWhy) => void
  onClose: () => void
}

// The fields live inside only while the sheet is open, so each opening starts
// from the saved name and why.
export function AspirationEditSheet({ open, initial, onSave, onClose }: AspirationEditSheetProps) {
  const dialog = useModalDialog(open)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Edit name and why</h2>
      </header>
      {open && initial && <EditForm initial={initial} onSave={onSave} onCancel={onClose} />}
    </dialog>
  )
}

type EditFormProps = {
  initial: NameAndWhy
  onSave: (changes: NameAndWhy) => void
  onCancel: () => void
}

function EditForm({ initial, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(initial.name)
  const [why, setWhy] = useState(initial.why)
  const nameId = useId()
  const whyId = useId()

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSaveName(name)) onSave({ name, why })
      }}
    >
      <label htmlFor={nameId}>Name</label>
      <input id={nameId} value={name} required autoComplete="off" onChange={(event) => setName(event.target.value)} />

      <label htmlFor={whyId}>Why</label>
      <textarea
        id={whyId}
        value={why}
        rows={3}
        placeholder="What would this give you?"
        onChange={(event) => setWhy(event.target.value)}
      />

      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="edit-form-save" disabled={!canSaveName(name)}>
          Save
        </button>
      </div>
    </form>
  )
}
