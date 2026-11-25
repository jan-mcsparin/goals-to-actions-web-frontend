import { useId } from 'react'
import type { UrgeLevel } from '../api/types.ts'
import type { RecordDay } from '../domain/quitting.ts'
import { QuitDayRow } from './QuitDayRow.tsx'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type QuitDaySheetProps = {
  // The day from the goal page's record; the sheet is open while there is one.
  day?: RecordDay
  onAnswer: (held: boolean) => void
  onClear: () => void
  onRate: (level: UrgeLevel | null) => void
  onClose: () => void
}

// One past day of a quitting goal, to answer, change or clear, and rate the urge.
export function QuitDaySheet({ day, onAnswer, onClear, onRate, onClose }: QuitDaySheetProps) {
  const dialog = useModalDialog(day !== undefined)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{day?.dayLabel}</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Done
        </button>
      </header>
      {day && (
        <QuitDayRow
          inSheet
          label={day.dayLabel}
          answer={day.answer}
          answerLabel={day.answerLabel}
          urge={day.urge}
          onAnswer={onAnswer}
          onClear={onClear}
          onRate={onRate}
        />
      )}
    </dialog>
  )
}
