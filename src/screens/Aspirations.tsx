import '../components/progressBar.css'
import type { AspirationCard, GoalRow } from '../domain/aspirations.ts'
import { useAspirations } from '../hooks/useAspirations.ts'
import './Aspirations.css'

type AspirationsProps = {
  onOpenAspiration: (aspirationId: string) => void
  onOpenGoal: (goalId: string) => void
}

export function Aspirations({ onOpenAspiration, onOpenGoal }: AspirationsProps) {
  const { view, message } = useAspirations()

  return (
    <main className="aspirations" aria-busy={!view && !message}>
      <header className="screen-top aspirations-header">
        <h1>Aspirations</h1>
      </header>

      {message && (
        <p className="aspirations-note" role="status">
          {message}
        </p>
      )}

      {view?.cards.map((card) => (
        <Card
          key={card.aspirationId}
          card={card}
          onOpen={() => onOpenAspiration(card.aspirationId)}
          onOpenGoal={onOpenGoal}
        />
      ))}
    </main>
  )
}

type CardProps = {
  card: AspirationCard
  onOpen: () => void
  onOpenGoal: (goalId: string) => void
}

// The card top and each goal row are separate buttons, side by side in the
// markup, so the two tap targets never nest.
function Card({ card, onOpen, onOpenGoal }: CardProps) {
  const nameId = `aspiration-${card.aspirationId}`
  const whyId = `${nameId}-why`
  return (
    <section className="aspiration-card" aria-labelledby={nameId}>
      <button
        type="button"
        className="aspiration-card-top"
        aria-labelledby={nameId}
        aria-describedby={card.why ? whyId : undefined}
        onClick={onOpen}
      >
        <span className="aspiration-card-name">
          <span id={nameId}>{card.name}</span>
          <span aria-hidden="true">›</span>
        </span>
        {card.why && (
          <span id={whyId} className="aspiration-card-why">
            {card.why}
          </span>
        )}
      </button>

      {card.week && (
        <div className="aspiration-week">
          <progress
            className="progress-bar"
            value={card.week.done}
            max={card.week.total}
            aria-label={`${card.name}, this week`}
          />
          <p>{card.week.label}</p>
        </div>
      )}

      {card.goals.length > 0 ? (
        <GoalRows rows={card.goals} onOpenGoal={onOpenGoal} />
      ) : (
        <p className="aspirations-note">No goals yet.</p>
      )}

      <p className="aspiration-recurring">{card.recurringLine}</p>
    </section>
  )
}

function GoalRows({ rows, onOpenGoal }: { rows: GoalRow[]; onOpenGoal: (goalId: string) => void }) {
  return (
    <ul className="goal-rows">
      {rows.map((row) => (
        <li key={row.goalId}>
          <button type="button" className="goal-row" onClick={() => onOpenGoal(row.goalId)}>
            <span className="goal-row-label">{row.label}</span>
            <span className="goal-row-progress">{row.progress}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
