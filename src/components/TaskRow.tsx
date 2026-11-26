import type { TaskRow as TaskRowData } from '../domain/today.ts'
import { TaskMenu } from './TaskMenu.tsx'
import './TaskRow.css'
import './taskText.css'
import { canTickLate, isDone } from '../domain/tasks'

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
// Done tasks have no menu (tapping again undoes them), and neither does a row given no actions (a
// closed week's day). A fixed-day item never goes to the bank, so its menu only moves it within
// its week and deletes. On a past day, a line under the title says how the task ended with its
// week (spec 081); one dropped since can't be ticked.
export function TaskRow({ row, onToggle, onSendToBank, onSwap, onMove, onRemove, onDelete, canCheck = true }: TaskRowProps) {
  const { task, timeLabel, subline, outcome } = row
  const done = isDone(task)
  const sendToBank = row.fixed ? undefined : onSendToBank
  const swap = row.fixed ? undefined : onSwap
  const hasMenu = !done && [sendToBank, swap, onMove, onRemove, onDelete].some(Boolean)
  const titleId = `task-${task.id}-title`
  const timeId = `task-${task.id}-time`
  const sublineId = `task-${task.id}-subline`
  const outcomeId = `task-${task.id}-outcome`
  const describedBy = [timeLabel && timeId, subline && sublineId, outcome && outcomeId].filter(Boolean).join(' ')

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
        disabled={!canCheck || !canTickLate(task)}
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
          {outcome && (
            <span id={outcomeId} className="task-subline">
              {outcome}
            </span>
          )}
        </span>
        {timeLabel && (
          <span id={timeId} className="task-time">
            {timeLabel}
          </span>
        )}
      </button>
      {hasMenu && (
        <TaskMenu
          taskTitle={task.title}
          onSendToBank={sendToBank}
          onSwap={swap}
          onMove={onMove}
          onRemove={onRemove}
          onDelete={onDelete}
        />
      )}
    </li>
  )
}
