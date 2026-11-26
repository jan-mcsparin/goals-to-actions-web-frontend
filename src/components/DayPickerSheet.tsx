import { useId } from 'react'
import type { PickableDay } from '../domain/week.ts'
import './sheet.css'
import './DayPickerSheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type DayPickerSheetProps = {
  open: boolean
  // "Put on a day" unless said otherwise.
  title?: string
  taskTitle?: string
  days: PickableDay[]
  onPick: (date: string) => void
  onClose: () => void
  // A bank task made by mistake (spec 038): offered under the days.
  onDelete?: () => void
}

export function DayPickerSheet({ open, title = 'Put on a day', taskTitle, days, onPick, onClose, onDelete }: DayPickerSheetProps) {
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
      {taskTitle && <p className="day-picker-task">{taskTitle}</p>}
      <ul className="day-picker-list">
        {days.map((day) => (
          <li key={day.date}>
            <button type="button" className="day-picker-day" onClick={() => onPick(day.date)}>
              {day.label}
            </button>
          </li>
        ))}
      </ul>
      {onDelete && (
        <button type="button" className="sheet-delete" onClick={onDelete}>
          Delete (made by mistake)
        </button>
      )}
    </dialog>
  )
}
