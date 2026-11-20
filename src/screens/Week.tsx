import { useState, type ReactNode } from 'react'
import type { Task } from '../api/types.ts'
import { DayPickerSheet } from '../components/DayPickerSheet.tsx'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import type { DaySummary, ProgressRow } from '../domain/week.ts'
import { useFleetingMessage } from '../hooks/useFleetingMessage.ts'
import { ViewToggle, type ViewOption } from '../components/ViewToggle.tsx'
import { useWeek } from '../hooks/useWeek.ts'
import type { WeekViewMode } from '../storage/weekView.ts'
import '../components/progressBar.css'
import './Week.css'

type WeekProps = {
  today: string
  onOpenDay: (date: string) => void
}

export function Week({ today, onOpenDay }: WeekProps) {
  const { title, range, week, message, view, canViewNext, setView, place } = useWeek(today)
  const [placing, setPlacing] = useState<Task>()
  // With nothing loaded, the message is all there is, so it stays.
  const shownMessage = useFleetingMessage(message, { sticky: !week })

  if (!week) {
    return (
      <main className="week" aria-busy={!message}>
        {message && <WeekTop title={title} range={range} />}
        <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
      </main>
    )
  }

  return (
    <main className="week">
      <WeekTop title={title} range={range}>
        {canViewNext && <ViewToggle label="Week" view={view} options={WEEK_VIEWS} onChange={setView} />}
      </WeekTop>

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

      <section className="week-section" aria-labelledby="week-bank">
        <h2 id="week-bank">{week.bank.length ? `Bank · ${week.bank.length} not on a day` : 'Bank'}</h2>
        {week.bank.length === 0 ? (
          <p className="week-bank-note">Nothing in the bank.</p>
        ) : (
          <>
            <ul className="week-bank">
              {week.bank.map((task) => (
                <li key={task.id}>
                  <button type="button" className="week-chip" onClick={() => setPlacing(task)}>
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
            <p className="week-bank-note">Tap to put on a day.</p>
          </>
        )}
      </section>

      <DayPickerSheet
        open={placing !== undefined}
        taskTitle={placing?.title}
        days={week.pickableDays}
        onPick={(date) => {
          if (placing) place(placing.id, date)
          setPlacing(undefined)
        }}
        onClose={() => setPlacing(undefined)}
      />

      <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
    </main>
  )
}

const WEEK_VIEWS: ViewOption<WeekViewMode>[] = [
  { view: 'this', label: 'This week' },
  { view: 'next', label: 'Next week' },
]

function WeekTop({ title, range, children }: { title: string; range: string; children?: ReactNode }) {
  return (
    <header className="screen-top week-header">
      <h1>{title}</h1>
      <p className="week-range">{range}</p>
      {children}
    </header>
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
        className="progress-bar"
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
