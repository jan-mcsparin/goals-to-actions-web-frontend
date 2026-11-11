// One aspiration: its week, goals, recurring items, past goals and place in
// priority. A retired one shows what it has seen and offers Bring back.
import { useEffect } from 'react'
import { BackLink } from '../components/BackLink.tsx'
import '../components/progressBar.css'
import type { ActivePage, GoalCard, PastGoalRow, RecurringRow, RetiredPage } from '../domain/aspiration.ts'
import { useAspiration } from '../hooks/useAspiration.ts'
import './Aspiration.css'

type AspirationProps = {
  aspirationId: string
  today: string
  onBack: () => void
  onOpenGoal: (goalId: string) => void
}

export function Aspiration({ aspirationId, today, onBack, onOpenGoal }: AspirationProps) {
  const { page, message, notFound, move } = useAspiration(aspirationId, today)

  useEffect(() => {
    if (notFound) onBack()
  }, [notFound, onBack])

  return (
    <main className="aspiration" aria-busy={!page && !message}>
      <header className="screen-top">
        <div className="aspiration-top-row">
          <BackLink to="Aspirations" onBack={onBack} />
          <span className="aspiration-kind">Aspiration</span>
        </div>
        {page && (
          <>
            <h1 className="screen-title">{page.name}</h1>
            {page.why && <p className="aspiration-why">{page.why}</p>}
          </>
        )}
      </header>

      {message && (
        <p className="aspiration-note" role="status">
          {message}
        </p>
      )}

      {page?.kind === 'active' && <Active page={page} onOpenGoal={onOpenGoal} onMove={move} />}
      {page?.kind === 'retired' && <Retired page={page} onOpenGoal={onOpenGoal} />}
    </main>
  )
}

type ActiveProps = {
  page: ActivePage
  onOpenGoal: (goalId: string) => void
  onMove: (direction: 'up' | 'down') => void
}

function Active({ page, onOpenGoal, onMove }: ActiveProps) {
  return (
    <>
      {page.week && (
        <section className="aspiration-section" aria-labelledby="aspiration-week">
          <div className="aspiration-section-head">
            <h2 id="aspiration-week">This week</h2>
            <span>{page.week.label}</span>
          </div>
          <progress
            className="progress-bar"
            value={page.week.done}
            max={page.week.total}
            aria-label={`${page.name}, this week`}
          />
        </section>
      )}

      <section className="aspiration-section" aria-labelledby="aspiration-goals">
        <div className="aspiration-section-head">
          <h2 id="aspiration-goals">Goals</h2>
          <span>{page.activeGoalsLine}</span>
        </div>
        {page.goals.length > 0 ? (
          <GoalCards cards={page.goals} onOpenGoal={onOpenGoal} />
        ) : (
          <p className="aspiration-note">No goals yet.</p>
        )}
      </section>

      <RecurringSection rows={page.recurring} />
      <PastGoals rows={page.pastGoals} onOpenGoal={onOpenGoal} />

      <section className="aspiration-section" aria-labelledby="aspiration-priority">
        <h2 id="aspiration-priority" tabIndex={-1}>
          Priority
        </h2>
        <div className="aspiration-priority">
          <div>
            <p className="aspiration-priority-line">{page.priority.line}</p>
            <p className="aspiration-note">{page.priority.hint}</p>
          </div>
          <div className="aspiration-moves">
            <button
              type="button"
              className="aspiration-move"
              aria-label="Move up"
              disabled={!page.priority.canMoveUp}
              onClick={() => onMove('up')}
            >
              ↑
            </button>
            <button
              type="button"
              className="aspiration-move"
              aria-label="Move down"
              disabled={!page.priority.canMoveDown}
              onClick={() => onMove('down')}
            >
              ↓
            </button>
          </div>
        </div>
      </section>

      <div className="aspiration-actions">
        <button type="button" className="aspiration-action">
          Edit name and why
        </button>
        <button type="button" className="aspiration-action">
          Review
        </button>
        <button type="button" className="aspiration-action">
          Retire
        </button>
      </div>
    </>
  )
}

function Retired({ page, onOpenGoal }: { page: RetiredPage; onOpenGoal: (goalId: string) => void }) {
  return (
    <>
      <p className="aspiration-note">{page.retiredLine}</p>

      {page.pausedGoals.length > 0 && (
        <section className="aspiration-section" aria-labelledby="aspiration-paused">
          <h2 id="aspiration-paused">Paused goals</h2>
          <GoalCards cards={page.pausedGoals} onOpenGoal={onOpenGoal} />
        </section>
      )}

      <RecurringSection rows={page.recurring} />
      <PastGoals rows={page.pastGoals} onOpenGoal={onOpenGoal} />

      <div className="aspiration-actions">
        <button type="button" className="aspiration-action">
          Bring back
        </button>
      </div>
    </>
  )
}

function GoalCards({ cards, onOpenGoal }: { cards: GoalCard[]; onOpenGoal: (goalId: string) => void }) {
  return (
    <ul className="goal-cards">
      {cards.map((card) => (
        <li key={card.goalId}>
          <button type="button" className="goal-card" onClick={() => onOpenGoal(card.goalId)}>
            <span className="goal-card-top">
              <span className="goal-card-label">{card.label}</span>
              <span className="goal-card-progress">{card.progress}</span>
            </span>
            <span className="goal-card-line">{card.measurableLine}</span>
            <progress className="progress-bar" value={card.reached} max={card.total} aria-hidden="true" />
            {card.weekLine && <span className="goal-card-week">{card.weekLine}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function RecurringSection({ rows }: { rows: RecurringRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="aspiration-section" aria-labelledby="aspiration-recurring">
      <h2 id="aspiration-recurring">Recurring</h2>
      <ul className="aspiration-rows">
        {rows.map((row) => (
          <li key={row.itemId}>
            <span>{row.name}</span>
            <span className="aspiration-row-detail">{row.paused ? 'Paused' : row.repeatRule}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PastGoals({ rows, onOpenGoal }: { rows: PastGoalRow[]; onOpenGoal: (goalId: string) => void }) {
  if (rows.length === 0) return null
  return (
    <details className="aspiration-more">
      <summary>{`Past goals (${rows.length})`}</summary>
      <ul className="aspiration-rows">
        {rows.map((row) => (
          <li key={row.goalId}>
            <button type="button" className="aspiration-row-button" onClick={() => onOpenGoal(row.goalId)}>
              <span>{row.label}</span>
              <span className="aspiration-row-detail">{row.outcome}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
