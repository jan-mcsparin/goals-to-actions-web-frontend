import { useId } from 'react'
import type { PickableDay } from '../domain/week.ts'
import './sheet.css'
import './DayPickerSheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type DayPickerSheetProps = {
  open: boolean
  taskTitle?: string
  days: PickableDay[]
  onPick: (date: string) => void
  onClose: () => void
}

export function DayPickerSheet({ open, taskTitle, days, onPick, onClose }: DayPickerSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Put on a day</h2>
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
    </dialog>
  )
}
