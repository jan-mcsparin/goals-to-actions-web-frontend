import { useId, useState } from 'react'
import type { ItsWork } from '../domain/aspiration.ts'
import './sheet.css'
import './RetireSheet.css'
import { useModalDialog } from './useModalDialog.ts'

type RetireSheetProps = {
  open: boolean
  name: string
  historyLine: string
  onRetire: (itsWork: ItsWork) => void
  onClose: () => void
}

const CHOICES: { value: ItsWork; label: string; line: string }[] = [
  { value: 'pause', label: 'Pause them', line: 'They leave your days. Resume any of them later.' },
  { value: 'keep', label: 'Keep them going', line: 'They carry on without an aspiration, under Other goals.' },
]

// Leads with what the aspiration has seen, then asks one thing.
export function RetireSheet({ open, name, historyLine, onRetire, onClose }: RetireSheetProps) {
  const dialog = useModalDialog(open)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{`Retire ${name}?`}</h2>
      </header>
      {open && <RetireForm name={name} historyLine={historyLine} onRetire={onRetire} onCancel={onClose} />}
    </dialog>
  )
}

type RetireFormProps = {
  name: string
  historyLine: string
  onRetire: (itsWork: ItsWork) => void
  onCancel: () => void
}

// Mounted only while open, so each opening starts on Pause them.
function RetireForm({ name, historyLine, onRetire, onCancel }: RetireFormProps) {
  const [itsWork, setItsWork] = useState<ItsWork>('pause')
  const groupName = useId()

  return (
    <form
      className="retire-form"
      onSubmit={(event) => {
        event.preventDefault()
        onRetire(itsWork)
      }}
    >
      <p className="retire-history">{historyLine}</p>

      <fieldset className="retire-choices">
        <legend>What should happen to its goals and recurring items?</legend>
        {CHOICES.map((choice) => (
          <label key={choice.value} className="retire-choice">
            <input
              type="radio"
              name={groupName}
              value={choice.value}
              checked={itsWork === choice.value}
              onChange={() => setItsWork(choice.value)}
            />
            <span>
              <span className="retire-choice-label">{choice.label}</span>
              <span className="retire-choice-line">{choice.line}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="retire-note">{`${name} moves to Retired, with its history. You can bring it back anytime.`}</p>

      <button type="submit" className="retire-confirm">{`Retire ${name}`}</button>
      <button type="button" className="retire-cancel" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
