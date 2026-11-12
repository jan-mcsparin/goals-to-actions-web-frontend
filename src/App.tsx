import { useCallback, useState } from 'react'
import { toLocalDay } from './api/dates.ts'
import { AddSheet } from './components/AddSheet.tsx'
import { ScreenMessage } from './components/ScreenMessage.tsx'
import { TabBar } from './components/TabBar.tsx'
import { addOriginFor, type AddOrigin } from './hooks/useAdd.ts'
import { DataRevision, useRevisionCounter } from './hooks/dataRevision.ts'
import { useFleetingMessage } from './hooks/useFleetingMessage.ts'
import { useNavigation, type Screen } from './hooks/useNavigation.ts'
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
  // The Add sheet, open while there's an origin. After a save the open screen
  // loads again (the data revision) and the app's own message says where it went.
  const [adding, setAdding] = useState<AddOrigin>()
  const { revision, bump } = useRevisionCounter()
  const [confirmation, setConfirmation] = useState<string>()
  const shownConfirmation = useFleetingMessage(confirmation)

  // Cleared on open, so the same line after the next save shows again.
  function openAdd(opening: Partial<AddOrigin> = {}) {
    setConfirmation(undefined)
    setAdding({ ...addOriginFor(current), ...opening })
  }

  // A new goal opens on its own page, where milestones are added.
  function saved(line: string, open?: Screen) {
    setAdding(undefined)
    bump()
    if (open) goTo(open)
    setConfirmation(line)
  }

  return (
    <DataRevision value={revision}>
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
            onRetired={backToAspirations}
            onAddGoal={() => openAdd({ tab: 'goal', aspirationId: current.aspirationId })}
            onAddRecurring={() => openAdd({ tab: 'recurring', aspirationId: current.aspirationId })}
            onOpenGoal={(goalId) =>
              goTo({ screen: 'goal', goalId, from: { screen: 'aspiration', aspirationId: current.aspirationId } })
            }
          />
        )}
        {current.screen === 'goal' && (
          <GoalDetail
            key={current.goalId}
            goalId={current.goalId}
            from={current.from}
            today={today}
            onBack={() => goTo(current.from)}
            onOpenAspiration={(aspirationId) => goTo({ screen: 'aspiration', aspirationId })}
            onNotFound={backToAspirations}
          />
        )}
        <ScreenMessage message={shownConfirmation.shown} onDismiss={shownConfirmation.dismiss} />
        <TabBar current={tabOf(current)} onSelect={(tab) => goTo({ screen: tab })} onAdd={() => openAdd()} />
        <AddSheet
          origin={adding}
          today={today}
          onSaved={saved}
          onChanged={bump}
          onClose={() => setAdding(undefined)}
        />
      </div>
    </DataRevision>
  )
}

export default App
