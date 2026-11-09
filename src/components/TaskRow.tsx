import type { TaskRow as TaskRowData } from '../domain/today.ts'

export function TaskRow({ row }: { row: TaskRowData }) {
  const { task, timeLabel, subline } = row
  return (
    <li className="task-row" data-done={task.status === 'done'}>
      <span className="task-check" aria-hidden="true" />
      <span className="task-text">
        <span className="task-title">{task.title}</span>
        {subline && <span className="task-subline">{subline}</span>}
      </span>
      {timeLabel && <span className="task-time">{timeLabel}</span>}
    </li>
  )
}
