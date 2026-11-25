import { useId } from 'react'
import type { Choice, Placement, TaskDraft } from '../domain/add.ts'
import './AddSheet.css'
import './editForm.css'

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: 'onToday', label: 'On today' },
  { value: 'inBank', label: 'In the bank' },
  { value: 'onADay', label: 'On a day' },
]

type TaskFormProps = {
  draft: TaskDraft
  goals: Choice[]
  goalsMessage?: string
  today: string
  canSave: boolean
  message?: string
  onChange: (changes: Partial<TaskDraft>) => void
  onSave: () => void
}

// The Add sheet's Task tab: the title, When, the day or due date it shows, and the goal. Only the
// title is required, and on a day, the day.
export function TaskForm({ draft, goals, goalsMessage, today, canSave, message, onChange, onSave }: TaskFormProps) {
  const titleId = useId()
  const goalId = useId()
  const goalsNoteId = useId()
  const dueId = useId()
  const timeKindId = useId()
  const placementName = useId()
  const dayId = useId()
  const atTimeId = useId()
  const dayNoteId = useId()

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

      <fieldset className="task-form-placement">
        <legend>When</legend>
        {/* Native radios: arrow keys move the choice. */}
        <div className="task-form-when">
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
        </div>
      </fieldset>

      {draft.placement === 'onADay' ? (
        <>
          <div className="add-form-row task-form-day">
            <div>
              <label htmlFor={dayId}>Day</label>
              <input
                id={dayId}
                type="date"
                min={today}
                required
                value={draft.day}
                aria-describedby={dayNoteId}
                onChange={(event) => onChange({ day: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor={atTimeId}>Time (optional)</label>
              <input id={atTimeId} type="time" value={draft.atTime} onChange={(event) => onChange({ atTime: event.target.value })} />
            </div>
          </div>
          <p id={dayNoteId} className="edit-form-note">
            It stays on that day, and the rest of the day is planned around it.
          </p>
        </>
      ) : (
        <>
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

        </>
      )}

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
