import { useId } from 'react'
import type { Choice, Placement, TaskDraft } from '../domain/add.ts'
import './AddSheet.css'
import './editForm.css'

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: 'inBank', label: 'In the bank' },
  { value: 'onToday', label: 'On today' },
]

type TaskFormProps = {
  draft: TaskDraft
  goals: Choice[]
  goalsMessage?: string
  canSave: boolean
  message?: string
  onChange: (changes: Partial<TaskDraft>) => void
  onSave: () => void
}

// The Add sheet's Task tab. Only the title is required.
export function TaskForm({ draft, goals, goalsMessage, canSave, message, onChange, onSave }: TaskFormProps) {
  const titleId = useId()
  const goalId = useId()
  const goalsNoteId = useId()
  const dueId = useId()
  const timeKindId = useId()
  const placementName = useId()

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) onSave()
      }}
    >
      <label htmlFor={titleId}>Title</label>
      <input
        id={titleId}
        data-autofocus
        value={draft.title}
        autoComplete="off"
        required
        onChange={(event) => onChange({ title: event.target.value })}
      />

      <label htmlFor={goalId}>Goal</label>
      <select
        id={goalId}
        value={draft.goalId}
        aria-describedby={goalsMessage ? goalsNoteId : undefined}
        onChange={(event) => onChange({ goalId: event.target.value })}
      >
        <option value="">None</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.label}
          </option>
        ))}
      </select>
      {goalsMessage && (
        <p id={goalsNoteId} className="edit-form-note">
          {goalsMessage}
        </p>
      )}

      <label htmlFor={dueId}>Due date (optional)</label>
      <input id={dueId} type="date" value={draft.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />

      <label htmlFor={timeKindId}>Time of day (optional)</label>
      <div className="add-form-row">
        <select
          id={timeKindId}
          value={draft.timeKind}
          onChange={(event) => onChange({ timeKind: event.target.value as TaskDraft['timeKind'] })}
        >
          <option value="">Any time</option>
          <option value="by">By</option>
          <option value="at">At</option>
        </select>
        {draft.timeKind && (
          <input
            type="time"
            aria-label="Time"
            value={draft.time}
            onChange={(event) => onChange({ time: event.target.value })}
          />
        )}
      </div>

      <fieldset className="task-form-placement">
        <legend>Put it</legend>
        {PLACEMENTS.map((placement) => (
          <label key={placement.value}>
            <input
              type="radio"
              name={placementName}
              value={placement.value}
              checked={draft.placement === placement.value}
              onChange={() => onChange({ placement: placement.value })}
            />
            {placement.label}
          </label>
        ))}
      </fieldset>

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
