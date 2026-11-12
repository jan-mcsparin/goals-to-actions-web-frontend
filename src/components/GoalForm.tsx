import { useEffect, useId, useRef, type Ref } from 'react'
import type { GoalType } from '../api/types.ts'
import { goalParts, needsLineField, NEW_ASPIRATION, type Choice, type GoalDraft } from '../domain/add.ts'
import './AddSheet.css'
import './editForm.css'

const TYPES: { type: GoalType; label: string }[] = [
  { type: 'building', label: 'Building' },
  { type: 'quitting', label: 'Quitting' },
  { type: 'oneOff', label: 'One-off' },
]

type GoalFormProps = {
  draft: GoalDraft
  today: string
  aspirations: Choice[]
  aspirationsMessage?: string
  canSave: boolean
  message?: string
  onChange: (changes: Partial<GoalDraft>) => void
  onSave: () => void
}

// The Add sheet's Goal tab. The type comes first and nothing else shows until
// it's picked; the person picks it, it's never guessed from the sentence.
export function GoalForm({ draft, today, aspirations, aspirationsMessage, canSave, message, onChange, onSave }: GoalFormProps) {
  const firstType = useRef<HTMLButtonElement>(null)
  const sentenceField = useRef<HTMLInputElement>(null)
  const typed = draft.type !== undefined

  // The types first, with no keyboard; once one is picked, the sentence.
  useEffect(() => {
    if (typed) sentenceField.current?.focus()
    else firstType.current?.focus()
  }, [typed])

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave()
      }}
    >
      <div className="add-choice" role="group" aria-label="Type">
        {TYPES.map(({ type, label }, index) => (
          <button
            key={type}
            ref={index === 0 ? firstType : undefined}
            type="button"
            aria-pressed={draft.type === type}
            onClick={() => onChange({ type })}
          >
            {label}
          </button>
        ))}
      </div>

      {typed && (
        <GoalFields
          draft={draft}
          today={today}
          aspirations={aspirations}
          aspirationsMessage={aspirationsMessage}
          sentenceRef={sentenceField}
          onChange={onChange}
        />
      )}

      {message && (
        <p className="edit-form-note" role="status">
          {message}
        </p>
      )}

      {typed && (
        <div className="edit-form-actions">
          <button type="submit" className="edit-form-save" disabled={!canSave}>
            Save
          </button>
        </div>
      )}
    </form>
  )
}

type GoalFieldsProps = Pick<GoalFormProps, 'draft' | 'today' | 'aspirations' | 'aspirationsMessage' | 'onChange'> & {
  sentenceRef: Ref<HTMLInputElement>
}

function GoalFields({ draft, today, aspirations, aspirationsMessage, sentenceRef, onChange }: GoalFieldsProps) {
  const sentenceId = useId()
  const partsId = useId()
  const lineId = useId()
  const aspirationId = useId()
  const aspirationsNoteId = useId()
  const newAspirationId = useId()
  const baselineId = useId()
  const targetId = useId()
  const startId = useId()
  const deadlineId = useId()
  const { label, measurableLine } = goalParts(draft)
  const askForLine = draft.sentence.trim() !== '' && needsLineField(draft.sentence)
  const startDate = draft.startDate || today

  return (
    <>
      <label htmlFor={sentenceId}>Goal</label>
      <input
        id={sentenceId}
        ref={sentenceRef}
        value={draft.sentence}
        placeholder="Be strong: bench 175, squat 350"
        autoComplete="off"
        required
        aria-describedby={label ? partsId : undefined}
        onChange={(event) => onChange({ sentence: event.target.value })}
      />
      {label && (
        <div id={partsId} className="goal-form-parts">
          <p>
            <span>Label:</span> {label}
          </p>
          {!askForLine && measurableLine && (
            <p>
              <span>Line:</span> {measurableLine}
            </p>
          )}
        </div>
      )}

      {askForLine && (
        <>
          <label htmlFor={lineId}>How will you know you've got there?</label>
          <input
            id={lineId}
            value={draft.measurableLine}
            autoComplete="off"
            required
            onChange={(event) => onChange({ measurableLine: event.target.value })}
          />
        </>
      )}

      <label htmlFor={aspirationId}>What's this for?</label>
      <select
        id={aspirationId}
        value={draft.aspirationId}
        aria-describedby={aspirationsMessage ? aspirationsNoteId : undefined}
        onChange={(event) => onChange({ aspirationId: event.target.value })}
      >
        <option value="">None</option>
        {aspirations.map((aspiration) => (
          <option key={aspiration.id} value={aspiration.id}>
            {aspiration.label}
          </option>
        ))}
        <option value={NEW_ASPIRATION}>New aspiration</option>
      </select>
      {aspirationsMessage && (
        <p id={aspirationsNoteId} className="edit-form-note">
          {aspirationsMessage}
        </p>
      )}
      {draft.aspirationId === NEW_ASPIRATION && (
        <>
          <label htmlFor={newAspirationId}>Aspiration name</label>
          <input
            id={newAspirationId}
            value={draft.newAspirationName}
            placeholder="Be fit"
            autoComplete="off"
            required
            onChange={(event) => onChange({ newAspirationName: event.target.value })}
          />
        </>
      )}

      <label htmlFor={baselineId}>Where are you now? (optional)</label>
      <input
        id={baselineId}
        value={draft.baseline}
        autoComplete="off"
        onChange={(event) => onChange({ baseline: event.target.value })}
      />

      {draft.type === 'building' && (
        <>
          <label htmlFor={targetId}>Weekly target (optional)</label>
          <div className="add-form-row">
            <input
              id={targetId}
              value={draft.target.amount}
              inputMode="numeric"
              placeholder="3"
              autoComplete="off"
              onChange={(event) => onChange({ target: { ...draft.target, amount: event.target.value } })}
            />
            <input
              aria-label="Unit"
              value={draft.target.unit}
              placeholder="sessions, runs, pages…"
              autoComplete="off"
              onChange={(event) => onChange({ target: { ...draft.target, unit: event.target.value } })}
            />
          </div>
        </>
      )}

      {draft.type === 'quitting' && (
        <>
          <label htmlFor={startId}>Start date</label>
          <input
            id={startId}
            type="date"
            value={startDate}
            onChange={(event) => onChange({ startDate: event.target.value })}
          />
        </>
      )}

      <label htmlFor={deadlineId}>Deadline (optional)</label>
      <input
        id={deadlineId}
        type="date"
        value={draft.deadline}
        min={draft.type === 'quitting' ? startDate : today}
        onChange={(event) => onChange({ deadline: event.target.value })}
      />
    </>
  )
}
