import '../components/progressBar.css'
import type { AspirationCard, GoalRow } from '../domain/aspirations.ts'
import { useAspirations } from '../hooks/useAspirations.ts'
import './Aspirations.css'

type AspirationsProps = {
  onOpenAspiration: (aspirationId: string) => void
  onOpenGoal: (goalId: string) => void
  onOpenUpkeep: () => void
}

const EMPTY = 'Nothing here yet. Start with one sentence: a goal, or who you want to be.'
const PRIORITY_HINT = 'In order of priority. The first comes first when goals compete for time.'

export function Aspirations({ onOpenAspiration, onOpenGoal, onOpenUpkeep }: AspirationsProps) {
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

      {view?.isEmpty && <p className="aspirations-note">{EMPTY}</p>}

      {view?.otherGoals && (
        <section className="aspirations-section" aria-labelledby="other-goals">
          <h2 id="other-goals">Other goals</h2>
          {view.otherGoals.goals.length > 0 && <GoalRows rows={view.otherGoals.goals} onOpenGoal={onOpenGoal} />}
          {view.otherGoals.past.length > 0 && (
            <details className="aspirations-more">
              <summary>{`Past goals (${view.otherGoals.past.length})`}</summary>
              <GoalRows rows={view.otherGoals.past} onOpenGoal={onOpenGoal} />
            </details>
          )}
        </section>
      )}

      {view && (
        <button type="button" className="upkeep-row" onClick={onOpenUpkeep}>
          <span>Keep life running</span>
          <span className="upkeep-row-count">
            {view.upkeepLine} <span aria-hidden="true">›</span>
          </span>
        </button>
      )}

      {view && view.retired.length > 0 && (
        <details className="aspirations-more">
          <summary>{`Retired (${view.retired.length})`}</summary>
          <ul className="goal-rows">
            {view.retired.map((retired) => (
              <li key={retired.aspirationId}>
                <button type="button" className="goal-row" onClick={() => onOpenAspiration(retired.aspirationId)}>
                  {retired.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {view && view.cards.length > 0 && <p className="aspirations-hint">{PRIORITY_HINT}</p>}
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
