// How long a screen's message stays. It shows when it arrives and clears itself
// after a few seconds, or at once when tapped. A new message, or the same one
// set again, shows and starts the timer over. A sticky one stays until tapped
// (a load failure, with nothing else on the screen).
import { useEffect, useState } from 'react'

const SHOWN_FOR_MS = 5000

export type FleetingMessage = {
  shown?: string
  dismiss: () => void
}

export function useFleetingMessage(message: string | undefined, { sticky = false } = {}): FleetingMessage {
  const [shown, setShown] = useState(message)
  const [arrived, setArrived] = useState(message)

  // Follows the screen's message as it changes (React's "adjust state when a prop changes").
  if (message !== arrived) {
    setArrived(message)
    setShown(message)
  }

  useEffect(() => {
    if (!shown || sticky) return
    const timer = setTimeout(() => setShown(undefined), SHOWN_FOR_MS)
    return () => clearTimeout(timer)
  }, [shown, sticky])

  return { shown, dismiss: () => setShown(undefined) }
}
