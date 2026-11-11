// A placeholder until Goal detail is built (#5): the label, and the way back
// to wherever the goal was opened from.
import { BackLink } from '../components/BackLink.tsx'
import { useAspirations } from '../hooks/useAspirations.ts'
import type { GoalOrigin } from '../hooks/useNavigation.ts'

type GoalDetailProps = {
  goalId: string
  from: GoalOrigin
  onBack: () => void
}

export function GoalDetail({ goalId, from, onBack }: GoalDetailProps) {
  const { overview } = useAspirations()
  const goal = overview?.goals.find((candidate) => candidate.id === goalId)
  // Back goes to an aspiration by id; name it only once its name is known.
  const backTo =
    from.screen === 'aspirations'
      ? 'Aspirations'
      : overview?.aspirations.find((candidate) => candidate.id === from.aspirationId)?.name

  return (
    <main aria-busy={!overview}>
      <header className="screen-top">
        <BackLink to={backTo} onBack={onBack} />
        {goal && <h1 className="screen-title">{goal.label}</h1>}
      </header>
    </main>
  )
}
