// The Aspirations tab, ready to render. Loads through the API client; the
// grouping and counting come from domain/aspirations.ts.
import { useEffect, useState } from 'react'
import { getAspirations } from '../api/client.ts'
import type { AspirationsOverview } from '../api/types.ts'
import { aspirationsView, type AspirationsView } from '../domain/aspirations.ts'

const LOAD_FAILED = "Couldn't load your aspirations. Try again in a moment."

export type UseAspirations = {
  view?: AspirationsView
  message?: string
}

export function useAspirations(): UseAspirations {
  const [overview, setOverview] = useState<AspirationsOverview>()
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let current = true
    getAspirations()
      .then((loaded) => current && setOverview(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [])

  return { view: overview && aspirationsView(overview), message }
}
