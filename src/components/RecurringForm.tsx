import { useId } from 'react'
import {
  FLEXIBLE_OPTIONS,
  MONTH_DAY_OPTIONS,
  WEEKDAY_OPTIONS,
  type Choice,
  type RecurringDraft,
  type RepeatOption,
} from '../domain/add.ts'
import './AddSheet.css'
import './editForm.css'

type RecurringFormProps = {
  draft: RecurringDraft
  aspirations: Choice[]
  aspirationsMessage?: string
  canSave: boolean
  message?: string
  onChange: (changes: Partial<RecurringDraft>) => void
  onSave: () => void
}

// The Add sheet's Recurring tab: a name, a fixed day (a weekday or a day of
// the month) or a flexible rhythm, and, optionally, an aspiration; with none
// it belongs to Keep life running. Opened on this tab, the sheet focuses
// Fixed day (AddSheet), so no keyboard comes up until a field is tapped.
export function RecurringForm({ draft, aspirations, aspirationsMessage, canSave, message, onChange, onSave }: RecurringFormProps) {
  const nameId = useId()
  const repeatId = useId()
  const aspirationId = useId()
  const aspirationsNoteId = useId()

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
        value={draft.name}
        placeholder="Take out the trash"
        autoComplete="off"
        required
        onChange={(event) => onChange({ name: event.target.value })}
      />

      <div className="add-choice" role="group" aria-label="Repeats">
        <button data-autofocus type="button" aria-pressed={draft.fixedDay} onClick={() => onChange({ fixedDay: true })}>
          Fixed day
        </button>
        <button type="button" aria-pressed={!draft.fixedDay} onClick={() => onChange({ fixedDay: false })}>
          Flexible
        </button>
      </div>

      {draft.fixedDay ? (
        <>
          <label htmlFor={repeatId}>Day</label>
          <select id={repeatId} value={draft.fixed} onChange={(event) => onChange({ fixed: event.target.value })}>
            <RepeatOptions label="Every week on" options={WEEKDAY_OPTIONS} />
            <RepeatOptions label="Every month on the" options={MONTH_DAY_OPTIONS} />
          </select>
        </>
      ) : (
        <>
          <label htmlFor={repeatId}>How often</label>
          <select id={repeatId} value={draft.flexible} onChange={(event) => onChange({ flexible: event.target.value })}>
            {FLEXIBLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor={aspirationId}>Under an aspiration (optional)</label>
      <select
        id={aspirationId}
        value={draft.aspirationId}
        aria-describedby={aspirationsMessage ? aspirationsNoteId : undefined}
        onChange={(event) => onChange({ aspirationId: event.target.value })}
      >
        <option value="">None (Keep life running)</option>
        {aspirations.map((aspiration) => (
          <option key={aspiration.id} value={aspiration.id}>
            {aspiration.label}
          </option>
        ))}
      </select>
      {aspirationsMessage && (
        <p id={aspirationsNoteId} className="edit-form-note">
          {aspirationsMessage}
        </p>
      )}

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

function RepeatOptions({ label, options }: { label: string; options: RepeatOption[] }) {
  return (
    <optgroup label={label}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </optgroup>
  )
}
