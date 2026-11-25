// The Keep life running page, ready to render. Loads through the API client;
// the rows come from domain/upkeep.ts.
import { getUpkeep } from '../api/client.ts'
import { upkeepView, type UpkeepView } from '../domain/upkeep.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load this page. Try again in a moment."

export type UseUpkeep = {
  view?: UpkeepView
  message?: string
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
}

export function useUpkeep(today: string): UseUpkeep {
  const { data: upkeep, message, setMessage } = useLoaded('upkeep', getUpkeep, LOAD_FAILED)

  return { view: upkeep && upkeepView(upkeep, today), message, clearMessage: () => setMessage(undefined) }
}
