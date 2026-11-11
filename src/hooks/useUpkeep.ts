// The Keep life running page, ready to render. Loads through the API client;
// the rows come from domain/upkeep.ts.
import { useEffect, useState } from 'react'
import { getUpkeep } from '../api/client.ts'
import type { Upkeep } from '../api/types.ts'
import { upkeepView, type UpkeepView } from '../domain/upkeep.ts'
import { useDataRevision } from './dataRevision.ts'

const LOAD_FAILED = "Couldn't load this page. Try again in a moment."

export type UseUpkeep = {
  view?: UpkeepView
  message?: string
}

export function useUpkeep(today: string): UseUpkeep {
  const [upkeep, setUpkeep] = useState<Upkeep>()
  const [message, setMessage] = useState<string>()
  const revision = useDataRevision()

  useEffect(() => {
    let current = true
    getUpkeep()
      .then((loaded) => current && setUpkeep(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [revision])

  return { view: upkeep && upkeepView(upkeep, today), message }
}
