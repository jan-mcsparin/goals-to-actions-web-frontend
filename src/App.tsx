import { useState } from 'react'
import { toLocalDay } from './api/dates.ts'
import { Day } from './screens/Day.tsx'

function App() {
  const [today] = useState(() => toLocalDay(new Date()))
  return <Day date={today} today={today} />
}

export default App
