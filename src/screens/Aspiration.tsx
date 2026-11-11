// A placeholder until the aspiration page is built (#13): the name and the way back.
import { BackLink } from '../components/BackLink.tsx'
import { useAspirations } from '../hooks/useAspirations.ts'

type AspirationProps = {
  aspirationId: string
  onBack: () => void
}

export function Aspiration({ aspirationId, onBack }: AspirationProps) {
  const { overview } = useAspirations()
  const aspiration = overview?.aspirations.find((candidate) => candidate.id === aspirationId)

  return (
    <main aria-busy={!overview}>
      <header className="screen-top">
        <BackLink to="Aspirations" onBack={onBack} />
        {aspiration && <h1 className="screen-title">{aspiration.name}</h1>}
      </header>
    </main>
  )
}
