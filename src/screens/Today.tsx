import { TaskRow } from '../components/TaskRow.tsx'
import type { Section } from '../domain/today.ts'
import { useToday } from '../hooks/useToday.ts'
import './Today.css'

export function Today() {
  const { today, message, toggleDone } = useToday()

  if (!today) {
    return (
      <main className="today" aria-busy={!message}>
        {message && <p role="status">{message}</p>}
      </main>
    )
  }

  const { heading, progress, sections } = today
  const isEmpty = progress.total === 0

  return (
    <main className="today">
      <header className="today-header">
        <h1>{heading}</h1>
        {!isEmpty && <p className="today-count">{`${progress.done} of ${progress.total} done`}</p>}
      </header>

      {message && (
        <p className="today-message" role="status">
          {message}
        </p>
      )}

      {!isEmpty && (
        <progress className="today-progress" value={progress.done} max={progress.total} aria-label="Done today" />
      )}

      {isEmpty ? (
        <p className="today-empty">Nothing planned today. The day is yours.</p>
      ) : (
        <>
          {sections.map((section) => (
            <TaskGroup key={section.id} section={section} onToggle={toggleDone} />
          ))}
          <section className="today-group" aria-labelledby="free-time">
            <h2 id="free-time">Free time</h2>
            <p className="today-free">The rest is yours.</p>
          </section>
        </>
      )}

      <button type="button" className="today-pull">
        Pull from bank
      </button>
    </main>
  )
}

type TaskGroupProps = {
  section: Section
  onToggle: (taskId: string) => void
}

function TaskGroup({ section, onToggle }: TaskGroupProps) {
  const headingId = `group-${section.id}`
  return (
    <section className="today-group" aria-labelledby={headingId}>
      <h2 id={headingId}>{section.title}</h2>
      <ul className="task-list">
        {section.rows.map((row) => (
          <TaskRow key={row.task.id} row={row} onToggle={() => onToggle(row.task.id)} />
        ))}
      </ul>
    </section>
  )
}
