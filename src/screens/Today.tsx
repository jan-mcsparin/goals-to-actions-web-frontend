import { useState } from 'react'
import { BankSheet } from '../components/BankSheet.tsx'
import { TaskRow } from '../components/TaskRow.tsx'
import { ViewToggle } from '../components/ViewToggle.tsx'
import type { Task } from '../api/types.ts'
import type { Section } from '../domain/today.ts'
import { useToday } from '../hooks/useToday.ts'
import './Today.css'

export function Today() {
  const {
    today,
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
  } = useToday()
  const [sheet, setSheet] = useState<Sheet>()

  function openSheet(next: Sheet) {
    setSheet(next)
    void loadBank()
  }

  function pickFromBank(bankTaskId: string) {
    if (sheet?.kind === 'swap') swap(sheet.taskId, bankTaskId)
    else pull(bankTaskId)
    setSheet(undefined)
  }

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
    <main className="today" data-view={view}>
      <header className="today-header">
        <h1>{heading}</h1>
        {!isEmpty && <p className="today-count">{`${progress.done} of ${progress.total} done`}</p>}
      </header>

      {message && (
        <p className="today-message" role="status">
          {message}
        </p>
      )}

      {!isEmpty && <ViewToggle view={view} onChange={setView} />}

      {!isEmpty && (
        <progress className="today-progress" value={progress.done} max={progress.total} aria-label="Done today" />
      )}

      {isEmpty ? (
        <p className="today-empty">Nothing planned today. The day is yours.</p>
      ) : (
        <>
          {sections.map((section) => (
            <TaskGroup
              key={section.id}
              section={section}
              onToggle={toggleDone}
              onSendToBank={sendToBank}
              onSwap={(task) => openSheet({ kind: 'swap', taskId: task.id, taskTitle: task.title })}
            />
          ))}
          <section className="today-free-time" aria-labelledby="free-time">
            <h2 id="free-time">Free time</h2>
            <p className="today-free">The rest is yours.</p>
          </section>
        </>
      )}

      <button
        type="button"
        className="today-pull"
        onClick={() => openSheet({ kind: 'pull' })}
      >
        Pull from bank
      </button>

      <BankSheet
        open={sheet !== undefined}
        title={sheet?.kind === 'swap' ? `Swap ${sheet.taskTitle} for` : 'Pull from bank'}
        rows={bankRows}
        message={bankMessage}
        onPick={pickFromBank}
        onClose={() => setSheet(undefined)}
      />
    </main>
  )
}

type Sheet = { kind: 'pull' } | { kind: 'swap'; taskId: string; taskTitle: string }

type TaskGroupProps = {
  section: Section
  onToggle: (taskId: string) => void
  onSendToBank: (taskId: string) => void
  onSwap: (task: Task) => void
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
            onSwap={() => onSwap(row.task)}
          />
        ))}
      </ul>
    </section>
  )
}
