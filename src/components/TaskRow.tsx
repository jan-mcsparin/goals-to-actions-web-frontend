import type { TaskRow as TaskRowData } from '../domain/today.ts'
import { TaskMenu } from './TaskMenu.tsx'

type TaskRowProps = {
  row: TaskRowData
  onToggle: () => void
  onSendToBank: () => void
  onSwap: () => void
}

// The whole row is the checkbox, so a tap anywhere on it checks the task off.
// Done tasks have no menu: tapping again is how you undo them.
export function TaskRow({ row, onToggle, onSendToBank, onSwap }: TaskRowProps) {
  const { task, timeLabel, subline } = row
  const done = task.status === 'done'
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
      {!done && <TaskMenu taskTitle={task.title} onSendToBank={onSendToBank} onSwap={onSwap} />}
    </li>
  )
}
