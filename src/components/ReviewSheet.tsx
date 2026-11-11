import { useId } from 'react'
import './sheet.css'
import './ReviewSheet.css'
import { useModalDialog } from './useModalDialog.ts'

export type ReviewChoice = 'keep' | 'edit' | 'move' | 'retire'

type ReviewSheetProps = {
  open: boolean
  name: string
  priorityLine: string
  onChoose: (choice: ReviewChoice) => void
  onClose: () => void
}

const CHOICES: { value: ReviewChoice; label: string }[] = [
  { value: 'keep', label: 'Keep as is' },
  { value: 'edit', label: 'Edit name and why' },
  { value: 'move', label: 'Move it' },
  { value: 'retire', label: 'Retire' },
]

// Opens only when the person taps Review. Nothing ever prompts it.
export function ReviewSheet({ open, name, priorityLine, onChoose, onClose }: ReviewSheetProps) {
  const dialog = useModalDialog(open)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <header className="sheet-header">
        <h2 id={titleId}>{`Review ${name}`}</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="review-questions">
        <p>Still the right aspiration?</p>
        <p>
          Still in the right place? <span className="review-place">{priorityLine}</span>
        </p>
      </div>
      <div className="review-choices" role="group" aria-label="Review choices">
        {CHOICES.map((choice) => (
          <button key={choice.value} type="button" className="review-choice" onClick={() => onChoose(choice.value)}>
            {choice.label}
          </button>
        ))}
      </div>
    </dialog>
  )
}
