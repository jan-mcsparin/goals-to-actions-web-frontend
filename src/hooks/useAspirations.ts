// The Aspirations tab, ready to render. Loads through the API client; the
// grouping and counting come from domain/aspirations.ts.
import { useEffect, useState } from 'react'
import { getAspirations } from '../api/client.ts'
import type { AspirationsOverview } from '../api/types.ts'
import { aspirationsView, type AspirationsView } from '../domain/aspirations.ts'
import { useDataRevision } from './dataRevision.ts'

const LOAD_FAILED = "Couldn't load your aspirations. Try again in a moment."

export type UseAspirations = {
  view?: AspirationsView
  message?: string
}

export function useAspirations(): UseAspirations {
  const [overview, setOverview] = useState<AspirationsOverview>()
  const [message, setMessage] = useState<string>()
  const revision = useDataRevision()

  useEffect(() => {
    let current = true
    getAspirations()
      .then((loaded) => {
        if (!current) return
        setOverview(loaded)
        setMessage((shown) => (shown === LOAD_FAILED ? undefined : shown))
      })
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [revision])

  return { view: overview && aspirationsView(overview), message }
}
