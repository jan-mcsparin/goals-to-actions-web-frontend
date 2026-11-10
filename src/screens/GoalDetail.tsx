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
  const cameFrom =
    from.screen === 'aspiration'
      ? overview?.aspirations.find((candidate) => candidate.id === from.aspirationId)?.name
      : undefined

  return (
    <main aria-busy={!overview}>
      <header className="screen-top">
        <BackLink to={cameFrom ?? 'Aspirations'} onBack={onBack} />
        {goal && <h1>{goal.label}</h1>}
      </header>
    </main>
  )
}
