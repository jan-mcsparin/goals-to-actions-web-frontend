// The Aspirations tab, ready to render. Loads through the API client; the
// grouping and counting come from domain/aspirations.ts.
import { getAspirations } from '../api/client.ts'
import { aspirationsView, type AspirationsView } from '../domain/aspirations.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load your aspirations. Try again in a moment."

export type UseAspirations = {
  view?: AspirationsView
  message?: string
}

export function useAspirations(): UseAspirations {
  const { data: overview, message } = useLoaded(getAspirations, LOAD_FAILED)

  return { view: overview && aspirationsView(overview), message }
}
