import { useEffect, useId, useRef } from 'react'
import type { TaskRow } from '../domain/today.ts'
import './BankSheet.css'
import './taskText.css'

type BankSheetProps = {
  open: boolean
  title: string
  rows?: TaskRow[]
  message?: string
  onPick: (taskId: string) => void
  onClose: () => void
}

// A native modal <dialog>: the browser moves focus in, closes on Escape and
// returns focus to the button that opened it.
export function BankSheet({ open, title, rows, message, onPick, onClose }: BankSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog ref={dialog} className="bank-sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="bank-sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="bank-sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      {message && (
        <p className="bank-sheet-note" role="status">
          {message}
        </p>
      )}
      {!message && !rows && <p className="bank-sheet-note">Loading…</p>}
      {rows && rows.length === 0 && <p className="bank-sheet-note">Nothing in the bank.</p>}
      {rows && rows.length > 0 && (
        <ul className="bank-sheet-list">
          {rows.map(({ task, subline, timeLabel }) => (
            <li key={task.id}>
              <button
                type="button"
                className="bank-sheet-task"
                aria-labelledby={`bank-${task.id}`}
                onClick={() => onPick(task.id)}
              >
                <span className="task-text">
                  <span id={`bank-${task.id}`} className="task-title">
                    {task.title}
                  </span>
                  {subline && <span className="task-subline">{subline}</span>}
                </span>
                {timeLabel && <span className="task-time">{timeLabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  )
}
