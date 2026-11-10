import { useState } from 'react'
import { toLocalDay } from './api/dates.ts'
import { TabBar } from './components/TabBar.tsx'
import { useNavigation } from './hooks/useNavigation.ts'
import { Aspirations } from './screens/Aspirations.tsx'
import { Day } from './screens/Day.tsx'
import { Week } from './screens/Week.tsx'
import { tabOf } from './storage/navigation.ts'
import './App.css'

function App() {
  const [today] = useState(() => toLocalDay(new Date()))
  const { current, goTo } = useNavigation()

  return (
    <div className="app">
      {current.screen === 'today' && <Day key="today" date={today} today={today} />}
      {current.screen === 'week' && (
        <Week today={today} onOpenDay={(date) => goTo({ screen: 'day', date })} />
      )}
      {current.screen === 'day' && (
        <Day key={current.date} date={current.date} today={today} onBack={() => goTo({ screen: 'week' })} />
      )}
      {tabOf(current) === 'aspirations' && <Aspirations onOpenAspiration={() => {}} onOpenGoal={() => {}} />}
      <TabBar current={tabOf(current)} onSelect={(tab) => goTo({ screen: tab })} />
    </div>
  )
}

export default App
