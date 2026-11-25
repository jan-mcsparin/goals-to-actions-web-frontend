import { useState } from 'react'
import type { UrgeLevel } from '../api/types.ts'
import { URGE_CHOICES, type QuitAnswer } from '../domain/quitting.ts'
import './QuitDayRow.css'

type QuitDayRowProps = {
  // The goal's label, or the day on the goal page: what the group is called.
  label: string
  answer: QuitAnswer
  answerLabel?: string
  urge: UrgeLevel | null
  onAnswer: (held: boolean) => void
  onClear: () => void
  onRate: (level: UrgeLevel | null) => void
  // In a sheet: the sheet names the day, and the choices stay out, since that's what it's for.
  inSheet?: boolean
}

// A quitting goal's held-or-not for one day, and the urge once answered. Nothing asks:
// it waits quietly, and an answer can be changed or cleared with a tap on it.
export function QuitDayRow({ label, answer, answerLabel, urge, onAnswer, onClear, onRate, inSheet = false }: QuitDayRowProps) {
  const [changing, setChanging] = useState(false)
  const answered = answer !== 'unanswered'
  const choosing = !answered || changing || inSheet

  function choose(next: () => void) {
    next()
    setChanging(false)
  }

  return (
    <div className="quit-day" role="group" aria-label={label}>
      {!inSheet && <span className="quit-day-label">{label}</span>}
      {choosing ? (
        <div className="quit-day-choices">
          <button type="button" aria-pressed={answer === 'held'} onClick={() => choose(() => onAnswer(true))}>
            Held
          </button>
          <button type="button" aria-pressed={answer === 'slipped'} onClick={() => choose(() => onAnswer(false))}>
            Slipped
          </button>
          {answered && (
            <button type="button" className="quit-day-clear" onClick={() => choose(onClear)}>
              Clear
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="quit-day-answer" aria-label={`Change: ${answerLabel}`} onClick={() => setChanging(true)}>
          {answerLabel}
        </button>
      )}
      {answered && (
        <div className="quit-day-urge" role="group" aria-label="Urge">
          {URGE_CHOICES.map((choice) => (
            <button
              key={choice.level}
              type="button"
              aria-pressed={urge === choice.level}
              onClick={() => onRate(urge === choice.level ? null : choice.level)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
