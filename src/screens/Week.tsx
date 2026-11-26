import { useState, type ReactNode } from 'react'
import type { Task } from '../api/types.ts'
import { DayPickerSheet } from '../components/DayPickerSheet.tsx'
import { DeleteSheet } from '../components/DeleteSheet.tsx'
import { deleteTaskLine } from '../domain/deleting.ts'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import { CountsLine } from '../components/CountsLine.tsx'
import { FullnessBar } from '../components/FullnessBar.tsx'
import { dayBarLabel, TYPICAL_WEEK, weekBarLabel, type DaySummary, type ProgressRow } from '../domain/week.ts'
import { useFleetingMessage } from '../hooks/useFleetingMessage.ts'
import { WrapUpSheet } from '../components/WrapUpSheet.tsx'
import { useWeek, type UseWeek } from '../hooks/useWeek.ts'
import '../components/progressBar.css'
import './Week.css'

type WeekProps = {
  today: string
  // The Monday of the week on show; none is this week.
  week?: string
  onShowWeek: (week?: string) => void
  onOpenDay: (date: string) => void
}

export function Week({ today, week: shown, onShowWeek, onOpenDay }: WeekProps) {
  const stepping = useWeek(today, shown, onShowWeek)
  const { week, message, clearMessage, place, deleting, wrapUp } = stepping
  const [wrapping, setWrapping] = useState(false)
  const [placing, setPlacing] = useState<Task>()
  // With nothing loaded, the message is all there is, so it stays.
  const shownMessage = useFleetingMessage(message, { sticky: !week, onGone: clearMessage })

  if (!week) {
    return (
      <main className="week" aria-busy={!message}>
        <WeekTop stepping={stepping} />
        <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
      </main>
    )
  }

  return (
    <main className="week">
      <WeekTop stepping={stepping}>
        {week.counts && (
          <div className="week-fullness">
            <CountsLine counts={week.counts} />
            <FullnessBar counts={week.counts} against={TYPICAL_WEEK} size="week" label={weekBarLabel(week.counts)} />
          </div>
        )}
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

      {wrapUp && (
        <button type="button" className="week-wrap-up" onClick={() => setWrapping(true)}>
          Wrap up this week
        </button>
      )}

      <WrapUpSheet
        open={wrapping && wrapUp !== undefined}
        carriesOver={wrapUp?.carriesOver ?? []}
        ends={wrapUp?.ends ?? []}
        onConfirm={() => {
          setWrapping(false)
          wrapUp?.confirm()
        }}
        onClose={() => setWrapping(false)}
      />

      <DayPickerSheet
        open={placing !== undefined}
        taskTitle={placing?.title}
        days={week.pickableDays}
        onPick={(date) => {
          if (placing) place(placing.id, date)
          setPlacing(undefined)
        }}
        onClose={() => setPlacing(undefined)}
        onDelete={() => {
          if (placing) deleting.ask(placing)
          setPlacing(undefined)
        }}
      />

      <DeleteSheet
        open={deleting.asking !== undefined}
        question={deleting.asking ? deleteTaskLine(deleting.asking.title) : ''}
        onDelete={() => void deleting.confirm()}
        onClose={deleting.cancel}
      />

      <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
    </main>
  )
}

// The pinned top: ‹ the week's title ›, its range, and the way back to this week.
function WeekTop({ stepping, children }: { stepping: UseWeek; children?: ReactNode }) {
  const { title, range, canGoBack, canGoForward, step, toThisWeek } = stepping
  return (
    <header className="screen-top week-header">
      <div className="week-title-row">
        <button
          type="button"
          className="week-arrow"
          aria-label="Previous week"
          disabled={!canGoBack}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <h1>{title}</h1>
        <button
          type="button"
          className="week-arrow"
          aria-label="Next week"
          disabled={!canGoForward}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
      <p className="week-range">{range}</p>
      {children}
      {toThisWeek && (
        <div className="week-links">
          <button type="button" className="week-link" onClick={toThisWeek}>
            This week
          </button>
        </div>
      )}
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
        {day.allDone ? <span className="week-day-mark">done</span> : day.full && <span className="week-day-mark">Full</span>}
        {day.fullness && (
          <FullnessBar
            counts={day.fullness.counts}
            against={day.fullness.cap}
            size="day"
            label={dayBarLabel(day.fullness.counts, day.fullness.cap)}
          />
        )}
      </button>
    </li>
  )
}
