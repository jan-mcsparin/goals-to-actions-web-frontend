import { useState } from 'react'
import { toLocalDay } from './api/dates.ts'
import { TabBar } from './components/TabBar.tsx'
import { useNavigation } from './hooks/useNavigation.ts'
import { Day } from './screens/Day.tsx'
import { Week } from './screens/Week.tsx'
import './App.css'

function App() {
  const [today] = useState(() => toLocalDay(new Date()))
  const { current, goTo } = useNavigation()

  return (
    <div className="app">
      {current.screen === 'today' && <Day key="today" date={today} today={today} />}
      {current.screen === 'week' && <Week />}
      {current.screen === 'day' && (
        <Day key={current.date} date={current.date} today={today} onBack={() => goTo({ screen: 'week' })} />
      )}
      <TabBar current={current.screen === 'today' ? 'today' : 'week'} onSelect={(tab) => goTo({ screen: tab })} />
    </div>
  )
}

export default App
