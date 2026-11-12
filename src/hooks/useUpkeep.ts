// The Keep life running page, ready to render. Loads through the API client;
// the rows come from domain/upkeep.ts.
import { getUpkeep } from '../api/client.ts'
import { upkeepView, type UpkeepView } from '../domain/upkeep.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load this page. Try again in a moment."

export type UseUpkeep = {
  view?: UpkeepView
  message?: string
}

export function useUpkeep(today: string): UseUpkeep {
  const { data: upkeep, message } = useLoaded(getUpkeep, LOAD_FAILED)

  return { view: upkeep && upkeepView(upkeep, today), message }
}
