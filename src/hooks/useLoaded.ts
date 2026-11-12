// Loads a screen's records, and loads them again when `load` or the data
// revision changes, keeping what's shown meanwhile. Only the newest load lands.
// The screen's one message slot lives here too: a failed load fills it, and a
// later load that works clears it, but leaves a save message alone (the reload
// doesn't redo the save). A record that isn't there is reported as notFound.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { NotFoundError } from '../api/client.ts'
import { useDataRevision } from './dataRevision.ts'

export type Loaded<T> = {
  data?: T
  setData: Dispatch<SetStateAction<T | undefined>>
  message?: string
  setMessage: Dispatch<SetStateAction<string | undefined>>
  notFound: boolean
}

// `load` must be stable: a module function, or wrapped in useCallback with the
// ids it reads, so it changes only when the screen shows something else.
export function useLoaded<T>(load: () => Promise<T>, loadFailed: string): Loaded<T> {
  const [data, setData] = useState<T>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const revision = useDataRevision()

  useEffect(() => {
    let current = true
    load()
      .then((loaded) => {
        if (!current) return
        setData(loaded)
        setMessage((shown) => (shown === loadFailed ? undefined : shown))
      })
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof NotFoundError) setNotFound(true)
        else setMessage(loadFailed)
      })
    return () => {
      current = false
    }
  }, [load, loadFailed, revision])

  return { data, setData, message, setMessage, notFound }
}
