// The one place screens change. Today this is remembered state; a router can
// replace the inside of this hook later without touching the screens.
import { useState } from 'react'
import { readScreen, saveScreen, type GoalOrigin, type Screen } from '../storage/navigation.ts'

export type { GoalOrigin, Screen }

export function useNavigation(): { current: Screen; goTo: (screen: Screen) => void } {
  const [current, setCurrent] = useState(readScreen)

  function goTo(next: Screen) {
    setCurrent(next)
    saveScreen(next)
  }

  return { current, goTo }
}
