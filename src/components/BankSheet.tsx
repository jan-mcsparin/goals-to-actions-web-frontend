import { useId } from 'react'
import type { TaskRow } from '../domain/today.ts'
import './sheet.css'
import './BankSheet.css'
import './taskText.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type BankSheetProps = {
  open: boolean
  title: string
  rows?: TaskRow[]
  message?: string
  onPick: (taskId: string) => void
  onClose: () => void
}

export function BankSheet({ open, title, rows, message, onPick, onClose }: BankSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      {message && (
        <p className="sheet-note" role="status">
          {message}
        </p>
      )}
      {!message && !rows && <p className="sheet-note">Loading…</p>}
      {rows && rows.length === 0 && <p className="sheet-note">Nothing in the bank.</p>}
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
