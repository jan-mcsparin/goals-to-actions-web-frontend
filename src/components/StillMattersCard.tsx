import { useId } from 'react'
import './StillMattersCard.css'

type StillMattersCardProps = {
  title: string
  onKeep: () => void
  onReschedule: () => void
  onDrop: () => void
  // Hides the card for the day without answering.
  onNotNow: () => void
}

// A quiet question, never a warning: nothing here says how long the task has waited.
export function StillMattersCard({ title, onKeep, onReschedule, onDrop, onNotNow }: StillMattersCardProps) {
  const questionId = useId()
  const titleId = useId()
  return (
    <section className="still-matters" role="group" aria-labelledby={`${questionId} ${titleId}`}>
      <div className="still-matters-text">
        <p id={questionId} className="still-matters-question">
          Still matter?
        </p>
        <p id={titleId} className="still-matters-title">
          {title}
        </p>
      </div>
      <div className="still-matters-actions">
        <button type="button" onClick={onKeep}>
          Keep
        </button>
        <button type="button" onClick={onReschedule}>
          Reschedule
        </button>
        <button type="button" onClick={onDrop}>
          Drop
        </button>
      </div>
      <button type="button" className="still-matters-not-now" onClick={onNotNow}>
        Not now
      </button>
    </section>
  )
}
