// Keep life running: what has to happen, under no goal. The page only shows;
// checking off and placing happen on Today and Week.
import { BackLink } from '../components/BackLink.tsx'
import { useUpkeep } from '../hooks/useUpkeep.ts'
import './Upkeep.css'

type UpkeepProps = {
  today: string
  onBack: () => void
}

export function Upkeep({ today, onBack }: UpkeepProps) {
  const { view, message } = useUpkeep(today)

  return (
    <main className="upkeep" aria-busy={!view && !message}>
      <header className="screen-top">
        <BackLink to="Aspirations" onBack={onBack} />
        <h1 className="screen-title">Keep life running</h1>
        <p className="upkeep-note">The things that have to happen, under no goal.</p>
      </header>

      {message && (
        <p className="upkeep-note" role="status">
          {message}
        </p>
      )}

      {view && (
        <>
          <section className="upkeep-section" aria-labelledby="upkeep-recurring">
            <h2 id="upkeep-recurring">Recurring</h2>
            {view.recurring.length === 0 ? (
              <p className="upkeep-note">No recurring items.</p>
            ) : (
              <ul className="upkeep-list">
                {view.recurring.map((item) => (
                  <li key={item.id}>
                    <span className="upkeep-title">{item.name}</span>
                    <span className="upkeep-detail">{item.repeatRule}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="upkeep-section" aria-labelledby="upkeep-todo">
            <h2 id="upkeep-todo">To do</h2>
            {view.todo.length === 0 ? (
              <p className="upkeep-note">Nothing waiting.</p>
            ) : (
              <ul className="upkeep-list">
                {view.todo.map((row) => (
                  <li key={row.taskId}>
                    <span className="upkeep-title">{row.title}</span>
                    <span className="upkeep-detail">{row.due ? `${row.where} · ${row.due}` : row.where}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
