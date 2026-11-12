import { useEffect, useId, useRef } from 'react'
import type { AspirationDraft } from '../domain/add.ts'
import './editForm.css'

type AspirationFormProps = {
  draft: AspirationDraft
  canSave: boolean
  message?: string
  onChange: (changes: Partial<AspirationDraft>) => void
  onSave: () => void
}

// The Add sheet's Aspiration tab. Only the name is required; it saves without
// a why, and nothing asks for one later.
export function AspirationForm({ draft, canSave, message, onChange, onSave }: AspirationFormProps) {
  const nameId = useId()
  const whyId = useId()
  const nameField = useRef<HTMLInputElement>(null)

  // Keyboard up for the one required field, on switching to this tab.
  useEffect(() => {
    nameField.current?.focus()
  }, [])

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave()
      }}
    >
      <label htmlFor={nameId}>Name</label>
      <input
        id={nameId}
        ref={nameField}
        data-autofocus
        value={draft.name}
        placeholder="Be fit"
        autoComplete="off"
        required
        onChange={(event) => onChange({ name: event.target.value })}
      />

      <label htmlFor={whyId}>What would this give you? (optional)</label>
      <textarea id={whyId} rows={3} value={draft.why} onChange={(event) => onChange({ why: event.target.value })} />

      {message && (
        <p className="edit-form-note" role="status">
          {message}
        </p>
      )}

      <div className="edit-form-actions">
        <button type="submit" className="edit-form-save" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  )
}

type AspirationSavedProps = {
  onAddGoal: () => void
  onDone: () => void
}

// After an aspiration saves, the sheet stays open to offer its first goal.
export function AspirationSaved({ onAddGoal, onDone }: AspirationSavedProps) {
  const addGoal = useRef<HTMLButtonElement>(null)

  // The Save button has gone; focus lands on the next step instead.
  useEffect(() => {
    addGoal.current?.focus()
  }, [])

  return (
    <div className="edit-form">
      <p className="sheet-note" role="status">
        Saved.
      </p>
      <div className="edit-form-actions">
        <button type="button" className="edit-form-cancel" onClick={onDone}>
          Done
        </button>
        <button ref={addGoal} type="button" className="edit-form-save" onClick={onAddGoal}>
          Add a goal for this
        </button>
      </div>
    </div>
  )
}
