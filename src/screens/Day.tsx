import { useEffect, useRef, useState } from 'react'
import { BankSheet } from '../components/BankSheet.tsx'
import { DayPickerSheet } from '../components/DayPickerSheet.tsx'
import { DeleteSheet } from '../components/DeleteSheet.tsx'
import { MoveSheet } from '../components/MoveSheet.tsx'
import { QuitDayRow } from '../components/QuitDayRow.tsx'
import { StillMattersCard } from '../components/StillMattersCard.tsx'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import { TaskRow } from '../components/TaskRow.tsx'
import { ViewToggle, type ViewOption } from '../components/ViewToggle.tsx'
import type { TodayViewMode } from '../storage/viewPreference.ts'
import '../components/progressBar.css'
import type { Task } from '../api/types.ts'
import { deleteTaskLine, removeTaskLine } from '../domain/deleting.ts'
import type { NotOpenDay } from '../domain/notOpenDay.ts'
import type { Section } from '../domain/today.ts'
import { useDay, type MoveOffer, type StillMattersAsk } from '../hooks/useDay.ts'
import { useFleetingMessage } from '../hooks/useFleetingMessage.ts'
import './Day.css'

type DayProps = {
  date: string
  today: string
  onBack?: () => void
}

export function Day({ date, today, onBack }: DayProps) {
  const {
    heading,
    weekTitle,
    day,
    asking,
    waiting,
    message,
    clearMessage,
    view,
    setView,
    toggleDone,
    bankRows,
    pull,
    sendToBank,
    swap,
    moveOffer,
    canRemove,
    move,
    deleting,
    removing,
    answerQuitDay,
    clearQuitDay,
    rateUrge,
  } = useDay(date, today)
  // With nothing loaded, the message is all there is, so it stays.
  const shownMessage = useFleetingMessage(message, { sticky: !day, onGone: clearMessage })
  const [sheet, setSheet] = useState<Sheet>()
  const [rescheduling, setRescheduling] = useState<StillMattersAsk>()
  const [moving, setMoving] = useState<{ task: Task; offer: MoveOffer }>()
  const focusAfterSwap = useRef<string>(undefined)

  // After a swap the button that opened the sheet is gone, so focus goes to
  // the task that took its place (TaskRow's id is `task-<id>`). This runs
  // after the children's effects, including the sheet closing, which would
  // otherwise move focus itself.
  useEffect(() => {
    if (!focusAfterSwap.current) return
    document.getElementById(`task-${focusAfterSwap.current}`)?.focus()
    focusAfterSwap.current = undefined
  })

  function openSheet(next: Sheet) {
    setSheet(next)
  }

  function pickFromBank(bankTaskId: string) {
    if (sheet?.kind === 'swap') {
      swap(sheet.taskId, bankTaskId)
      focusAfterSwap.current = bankTaskId
    } else {
      pull(bankTaskId)
    }
    setSheet(undefined)
  }

  if (!day) {
    return (
      <main className="today" aria-busy={!message}>
        {message && <DayTop heading={heading} weekTitle={weekTitle} onBack={onBack} />}
        <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
      </main>
    )
  }

  const { isToday, canPlace, canCheckOff, progress, sections, quitRows, notOpen } = day
  const isEmpty = progress.total === 0
  const emptyLine = isToday ? 'Nothing planned today. The day is yours.' : 'Nothing planned. The day is yours.'
  const swapTask = canPlace
    ? (task: Task) => openSheet({ kind: 'swap', taskId: task.id, taskTitle: task.title })
    : undefined
  const moveTask = (task: Task) => {
    const offer = moveOffer(task)
    return offer && (() => setMoving({ task, offer }))
  }
  const removeTask = (task: Task) => (canRemove(task) ? () => removing.ask(task) : undefined)

  function moveTo(picked: string) {
    if (moving) move(moving.task.id, picked)
    setMoving(undefined)
  }

  return (
    <main className="today" data-view={view}>
      <DayTop
        heading={heading}
        weekTitle={weekTitle}
        onBack={onBack}
        progress={isEmpty || notOpen ? undefined : { ...progress, label: isToday ? 'Done today' : 'Done this day' }}
      />

      {waiting && <p className="today-waiting">{waiting}</p>}

      {asking.map((ask) => (
        <StillMattersCard
          key={ask.task.id}
          title={ask.task.title}
          onKeep={ask.keep}
          onReschedule={() => setRescheduling(ask)}
          onDrop={ask.drop}
          onNotNow={ask.notNow}
        />
      ))}

      {!notOpen && !isEmpty && <ViewToggle label="View" view={view} options={DAY_VIEWS} onChange={setView} />}

      {notOpen ? (
        <NotOpenDayBody day={notOpen} onMove={moveTask} onRemove={removeTask} onDelete={deleting.ask} />
      ) : isEmpty ? (
        <p className="today-empty">{emptyLine}</p>
      ) : (
        sections.map((section) => (
          <TaskGroup
            key={section.id}
            section={section}
            doneLabel={isToday ? 'done today' : 'done this day'}
            canCheck={canCheckOff}
            onToggle={toggleDone}
            onSendToBank={sendToBank}
            onSwap={swapTask}
            onMove={moveTask}
            onRemove={removeTask}
            onDelete={deleting.ask}
          />
        ))
      )}

      {quitRows.length > 0 && (
        <div className="today-quit">
          {quitRows.map((row) => (
            <QuitDayRow
              key={row.goalId}
              label={row.label}
              answer={row.answer}
              answerLabel={row.answerLabel}
              urge={row.urge}
              onAnswer={(held) => answerQuitDay(row.goalId, held)}
              onClear={() => clearQuitDay(row.goalId)}
              onRate={(level) => rateUrge(row.goalId, level)}
            />
          ))}
        </div>
      )}

      {!notOpen && !isEmpty && (
        <section className="today-free-time" aria-labelledby="free-time">
          <h2 id="free-time">Free time</h2>
          <p className="today-free">The rest is yours.</p>
        </section>
      )}

      {canPlace && (
        <button type="button" className="today-pull" onClick={() => openSheet({ kind: 'pull' })}>
          Pull from bank
        </button>
      )}

      <BankSheet
        open={sheet !== undefined}
        title={sheet?.kind === 'swap' ? `Swap ${sheet.taskTitle} for` : 'Pull from bank'}
        rows={bankRows}
        onPick={pickFromBank}
        onClose={() => setSheet(undefined)}
      />

      <DayPickerSheet
        open={rescheduling !== undefined}
        taskTitle={rescheduling?.task.title}
        days={rescheduling?.days ?? []}
        onPick={(picked) => {
          rescheduling?.reschedule(picked)
          setRescheduling(undefined)
        }}
        onClose={() => setRescheduling(undefined)}
      />

      <MoveSheet
        open={moving?.offer.kind === 'anyDay'}
        taskTitle={moving?.task.title}
        from={moving?.offer.kind === 'anyDay' ? moving.offer.from : undefined}
        min={moving?.offer.kind === 'anyDay' ? moving.offer.min : undefined}
        onMove={moveTo}
        onClose={() => setMoving(undefined)}
      />

      <DayPickerSheet
        open={moving?.offer.kind === 'inWeek'}
        title="Move to another day"
        taskTitle={moving?.task.title}
        days={moving?.offer.kind === 'inWeek' ? moving.offer.days : []}
        onPick={moveTo}
        onClose={() => setMoving(undefined)}
      />

      <DeleteSheet
        open={removing.asking !== undefined}
        question={removing.asking ? removeTaskLine(removing.asking.title) : ''}
        confirmLabel="Remove"
        onDelete={() => void removing.confirm()}
        onClose={removing.cancel}
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

type NotOpenDayBodyProps = {
  day: NotOpenDay
  onMove: (task: Task) => (() => void) | undefined
  onRemove: (task: Task) => (() => void) | undefined
  onDelete: (task: Task) => void
}

// What's set to the day, each with its menu, then what's known of it, read-only. No bank, so no
// Back to bank, Pull or Swap; nothing can be checked off before the week starts.
function NotOpenDayBody({ day, onMove, onRemove, onDelete }: NotOpenDayBodyProps) {
  const { rows, alsoThatDay } = day
  return (
    <>
      <p className="today-note">Only what's set to a day shows here. Recurring work is placed when this week opens.</p>
      {rows.length === 0 && alsoThatDay.length === 0 && <p className="today-empty">Nothing set yet</p>}
      {rows.length > 0 && (
        <ul className="task-list">
          {rows.map((row) => (
            <TaskRow
              key={row.task.id}
              row={row}
              canCheck={false}
              onToggle={() => {}}
              onMove={onMove(row.task)}
              onRemove={onRemove(row.task)}
              onDelete={() => onDelete(row.task)}
            />
          ))}
        </ul>
      )}
      {alsoThatDay.length > 0 && (
        <section className="today-group" aria-labelledby="also-that-day">
          <h2 id="also-that-day">Also that day</h2>
          <ul className="today-known">
            {alsoThatDay.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

type DayTopProps = {
  heading: string
  weekTitle: string
  onBack?: () => void
  // Left out while nothing has loaded, or nothing is planned.
  progress?: { done: number; total: number; label: string }
}

// The pinned top: the way back, the heading, and the count and bar.
function DayTop({ heading, weekTitle, onBack, progress }: DayTopProps) {
  return (
    <div className="screen-top today-top">
      {onBack && (
        <button type="button" className="today-back" aria-label={`Back to ${weekTitle}`} onClick={onBack}>
          {`‹ ${weekTitle}`}
        </button>
      )}
      <header className="today-header">
        <h1>{heading}</h1>
        {progress && <p className="today-count">{`${progress.done} of ${progress.total} done`}</p>}
      </header>
      {progress && (
        <progress className="today-progress" value={progress.done} max={progress.total} aria-label={progress.label} />
      )}
    </div>
  )
}

const DAY_VIEWS: ViewOption<TodayViewMode>[] = [
  { view: 'list', label: 'List' },
  { view: 'byGoal', label: 'By goal' },
]

type Sheet = { kind: 'pull' } | { kind: 'swap'; taskId: string; taskTitle: string }

type TaskGroupProps = {
  section: Section
  // Ends the card bar's label: "Be strong · Be fit done today".
  doneLabel: string
  canCheck: boolean
  onToggle: (taskId: string) => void
  onSendToBank: (taskId: string) => void
  onSwap?: (task: Task) => void
  // What the task's menu offers, if anything.
  onMove: (task: Task) => (() => void) | undefined
  onRemove: (task: Task) => (() => void) | undefined
  onDelete: (task: Task) => void
}

function TaskGroup({ section, doneLabel, canCheck, onToggle, onSendToBank, onSwap, onMove, onRemove, onDelete }: TaskGroupProps) {
  const headingId = `group-${section.id}`
  return (
    <section className="today-group" aria-labelledby={headingId}>
      <h2 id={headingId}>{section.title}</h2>
      {section.progress && (
        <progress
          className="progress-bar today-group-progress"
          value={section.progress.done}
          max={section.progress.total}
          aria-label={`${section.title} ${doneLabel}`}
        />
      )}
      <ul className="task-list">
        {section.rows.map((row) => (
          <TaskRow
            key={row.task.id}
            row={row}
            canCheck={canCheck}
            onToggle={() => onToggle(row.task.id)}
            onSendToBank={() => onSendToBank(row.task.id)}
            onSwap={onSwap && (() => onSwap(row.task))}
            onMove={onMove(row.task)}
            onRemove={onRemove(row.task)}
            onDelete={() => onDelete(row.task)}
          />
        ))}
      </ul>
    </section>
  )
}
