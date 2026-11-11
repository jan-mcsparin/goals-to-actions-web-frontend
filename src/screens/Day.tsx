import { useEffect, useRef, useState } from 'react'
import { BankSheet } from '../components/BankSheet.tsx'
import { ScreenMessage } from '../components/ScreenMessage.tsx'
import { TaskRow } from '../components/TaskRow.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import type { Task } from '../api/types.ts'
import type { Section } from '../domain/today.ts'
import { useDay } from '../hooks/useDay.ts'
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
    day,
    message,
    view,
    setView,
    toggleDone,
    bankRows,
    bankMessage,
    loadBank,
    pull,
    sendToBank,
    swap,
  } = useDay(date, today)
  // With nothing loaded, the message is all there is, so it stays.
  const shownMessage = useFleetingMessage(message, { sticky: !day })
  const [sheet, setSheet] = useState<Sheet>()
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
    void loadBank()
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
        {message && <DayTop heading={heading} onBack={onBack} />}
        <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
      </main>
    )
  }

  const { isToday, canPlace, progress, sections } = day
  const isEmpty = progress.total === 0
  const emptyLine = isToday ? 'Nothing planned today. The day is yours.' : 'Nothing planned. The day is yours.'
  const swapTask = canPlace
    ? (task: Task) => openSheet({ kind: 'swap', taskId: task.id, taskTitle: task.title })
    : undefined

  return (
    <main className="today" data-view={view}>
      <DayTop
        heading={heading}
        onBack={onBack}
        progress={isEmpty ? undefined : { ...progress, label: isToday ? 'Done today' : 'Done this day' }}
      />

      {!isEmpty && <ViewToggle view={view} onChange={setView} />}

      {isEmpty ? (
        <p className="today-empty">{emptyLine}</p>
      ) : (
        <>
          {sections.map((section) => (
            <TaskGroup
              key={section.id}
              section={section}
              onToggle={toggleDone}
              onSendToBank={sendToBank}
              onSwap={swapTask}
            />
          ))}
          <section className="today-free-time" aria-labelledby="free-time">
            <h2 id="free-time">Free time</h2>
            <p className="today-free">The rest is yours.</p>
          </section>
        </>
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
        message={bankMessage}
        onPick={pickFromBank}
        onClose={() => setSheet(undefined)}
      />

      <ScreenMessage message={shownMessage.shown} onDismiss={shownMessage.dismiss} />
    </main>
  )
}

type DayTopProps = {
  heading: string
  onBack?: () => void
  // Left out while nothing has loaded, or nothing is planned.
  progress?: { done: number; total: number; label: string }
}

// The pinned top: the way back, the heading, and the count and bar.
function DayTop({ heading, onBack, progress }: DayTopProps) {
  return (
    <div className="screen-top today-top">
      {onBack && (
        <button type="button" className="today-back" aria-label="Back to Week" onClick={onBack}>
          ‹ Week
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

type Sheet = { kind: 'pull' } | { kind: 'swap'; taskId: string; taskTitle: string }

type TaskGroupProps = {
  section: Section
  onToggle: (taskId: string) => void
  onSendToBank: (taskId: string) => void
  onSwap?: (task: Task) => void
}

function TaskGroup({ section, onToggle, onSendToBank, onSwap }: TaskGroupProps) {
  const headingId = `group-${section.id}`
  return (
    <section className="today-group" aria-labelledby={headingId}>
      <h2 id={headingId}>{section.title}</h2>
      <ul className="task-list">
        {section.rows.map((row) => (
          <TaskRow
            key={row.task.id}
            row={row}
            onToggle={() => onToggle(row.task.id)}
            onSendToBank={() => onSendToBank(row.task.id)}
            onSwap={onSwap && (() => onSwap(row.task))}
          />
        ))}
      </ul>
    </section>
  )
}
