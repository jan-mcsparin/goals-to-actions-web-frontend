import type { DaySummary, ProgressRow } from '../domain/week.ts'
import { useWeek } from '../hooks/useWeek.ts'
import './Week.css'

type WeekProps = {
  today: string
  onOpenDay: (date: string) => void
}

export function Week({ today, onOpenDay }: WeekProps) {
  const { week, message } = useWeek(today)

  if (!week) {
    return (
      <main className="week" aria-busy={!message}>
        {message && <p role="status">{message}</p>}
      </main>
    )
  }

  return (
    <main className="week">
      <header className="week-header">
        <h1>This week</h1>
        <p className="week-range">{week.range}</p>
      </header>

      {week.progress.length > 0 && (
        <section className="week-section" aria-labelledby="week-progress">
          <h2 id="week-progress">Progress</h2>
          {week.progress.map((row) => (
            <GoalProgress key={row.goalId} row={row} />
          ))}
        </section>
      )}

      <section className="week-section" aria-labelledby="week-days">
        <h2 id="week-days">Days</h2>
        <ul className="week-days">
          {week.days.map((day) => (
            <DayRow key={day.date} day={day} onOpen={() => onOpenDay(day.date)} />
          ))}
        </ul>
      </section>
    </main>
  )
}

function GoalProgress({ row }: { row: ProgressRow }) {
  const titleId = `progress-${row.goalId}`
  return (
    <div className="week-goal">
      <div className="week-goal-line">
        <span id={titleId}>{row.title}</span>
        <span className="week-goal-count">{`${row.done} of ${row.target}`}</span>
      </div>
      <progress
        className="week-goal-bar"
        value={Math.min(row.done, row.target)}
        max={row.target}
        aria-labelledby={titleId}
      />
      <p className="week-goal-pacing">{row.pacing}</p>
    </div>
  )
}

function DayRow({ day, onOpen }: { day: DaySummary; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        className="week-day"
        aria-current={day.isToday ? 'date' : undefined}
        data-past={day.isPast}
        onClick={onOpen}
      >
        <span className="week-day-name">{day.weekday}</span>
        <span className="week-day-summary">{day.summary}</span>
        {day.allDone && <span className="week-day-done">done</span>}
      </button>
    </li>
  )
}
