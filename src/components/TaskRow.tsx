import type { TaskRow as TaskRowData } from '../domain/today.ts'
import { TaskMenu } from './TaskMenu.tsx'
import './TaskRow.css'
import './taskText.css'
import { isDone } from '../domain/tasks'

type TaskRowProps = {
  row: TaskRowData
  onToggle: () => void
  // Left out where there's no bank: a week that hasn't opened.
  onSendToBank?: () => void
  onSwap?: () => void
  onMove?: () => void
  onRemove?: () => void
  onDelete?: () => void
  // False for a task in a week that hasn't started: it can be moved, not checked off.
  canCheck?: boolean
}

// The whole row is the checkbox, so a tap anywhere on it checks the task off.
// Done tasks have no menu (tapping again undoes them). A fixed-day item never goes to the bank,
// so its menu only moves it within its week and deletes.
export function TaskRow({ row, onToggle, onSendToBank, onSwap, onMove, onRemove, onDelete, canCheck = true }: TaskRowProps) {
  const { task, timeLabel, subline } = row
  const done = isDone(task)
  const titleId = `task-${task.id}-title`
  const timeId = `task-${task.id}-time`
  const sublineId = `task-${task.id}-subline`
  const describedBy = [timeLabel && timeId, subline && sublineId].filter(Boolean).join(' ')

  return (
    <li className="task-item">
      <button
        id={`task-${task.id}`}
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-labelledby={titleId}
        aria-describedby={describedBy || undefined}
        className="task-row"
        disabled={!canCheck}
        onClick={onToggle}
      >
        <span className="task-check" aria-hidden="true" />
        <span className="task-text">
          <span id={titleId} className="task-title">
            {task.title}
          </span>
          {subline && (
            <span id={sublineId} className="task-subline">
              {subline}
            </span>
          )}
        </span>
        {timeLabel && (
          <span id={timeId} className="task-time">
            {timeLabel}
          </span>
        )}
      </button>
      {!done && (onDelete || !row.fixed) && (
        <TaskMenu
          taskTitle={task.title}
          onSendToBank={row.fixed ? undefined : onSendToBank}
          onSwap={row.fixed ? undefined : onSwap}
          onMove={onMove}
          onRemove={onRemove}
          onDelete={onDelete}
        />
      )}
    </li>
  )
}
