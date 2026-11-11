import { useCallback, useState } from 'react'
import { toLocalDay } from './api/dates.ts'
import { TabBar } from './components/TabBar.tsx'
import { useNavigation } from './hooks/useNavigation.ts'
import { Aspiration } from './screens/Aspiration.tsx'
import { Aspirations } from './screens/Aspirations.tsx'
import { Day } from './screens/Day.tsx'
import { GoalDetail } from './screens/GoalDetail.tsx'
import { Upkeep } from './screens/Upkeep.tsx'
import { Week } from './screens/Week.tsx'
import { tabOf } from './storage/navigation.ts'
import './App.css'

function App() {
  const [today] = useState(() => toLocalDay(new Date()))
  const { current, goTo } = useNavigation()
  // Stable, so the Aspiration page's not-found effect runs once.
  const backToAspirations = useCallback(() => goTo({ screen: 'aspirations' }), [goTo])

  return (
    <div className="app">
      {current.screen === 'today' && <Day key="today" date={today} today={today} />}
      {current.screen === 'week' && (
        <Week today={today} onOpenDay={(date) => goTo({ screen: 'day', date })} />
      )}
      {current.screen === 'day' && (
        <Day key={current.date} date={current.date} today={today} onBack={() => goTo({ screen: 'week' })} />
      )}
      {current.screen === 'aspirations' && (
        <Aspirations
          onOpenAspiration={(aspirationId) => goTo({ screen: 'aspiration', aspirationId })}
          onOpenGoal={(goalId) => goTo({ screen: 'goal', goalId, from: { screen: 'aspirations' } })}
          onOpenUpkeep={() => goTo({ screen: 'upkeep' })}
        />
      )}
      {current.screen === 'upkeep' && <Upkeep today={today} onBack={() => goTo({ screen: 'aspirations' })} />}
      {current.screen === 'aspiration' && (
        <Aspiration
          key={current.aspirationId}
          aspirationId={current.aspirationId}
          today={today}
          onBack={backToAspirations}
          onOpenGoal={(goalId) =>
            goTo({ screen: 'goal', goalId, from: { screen: 'aspiration', aspirationId: current.aspirationId } })
          }
        />
      )}
      {current.screen === 'goal' && (
        <GoalDetail key={current.goalId} goalId={current.goalId} from={current.from} onBack={() => goTo(current.from)} />
      )}
      <TabBar current={tabOf(current)} onSelect={(tab) => goTo({ screen: tab })} />
    </div>
  )
}

export default App
