// Loads a screen's records, and loads them again when `load` or the data
// revision changes, keeping what's shown meanwhile. Only the newest load lands.
// The screen's one message slot lives here too: a failed load fills it, and a
// later load that works clears it, but leaves a save message alone (the reload
// doesn't redo the save). A record that isn't there is reported as notFound.
// Signed out says nothing here: the sign-in page is the message.
//
// Each read's last response is kept on the phone under `key` (ADR-010), so the
// screen opens from it at once and reads offline; the fresh load replaces it
// when it lands. The store is only a copy: when it fails, the screen works
// without it.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { NotFoundError, SignedOutError } from '../api/client.ts'
import { planStore } from '../storage/planStore.ts'
import { useDataRevision } from './dataRevision.ts'

export type Loaded<T> = {
  data?: T
  setData: Dispatch<SetStateAction<T | undefined>>
  message?: string
  setMessage: Dispatch<SetStateAction<string | undefined>>
  notFound: boolean
}

// `load` must be stable: a module function, or wrapped in useCallback with the
// ids it reads, so it changes only when the screen shows something else. `key`
// names the read and its id, such as `goal/<id>`, and changes with `load`.
export function useLoaded<T>(key: string, load: () => Promise<T>, loadFailed: string): Loaded<T> {
  const [data, setData] = useState<T>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const revision = useDataRevision()

  useEffect(() => {
    let current = true
    // Only a fresh response, or word that the record is gone, outranks the
    // stored one; a failed load (as offline, often before the store has
    // answered) leaves the stored one to show.
    let landed = false
    const { responses } = planStore()
    responses
      .get(key)
      .then((stored) => {
        if (current && !landed && stored !== undefined) setData((shown) => shown ?? (stored as T))
      })
      .catch(() => {})
    load()
      .then((loaded) => {
        landed = true
        responses.put(key, loaded).catch(() => {})
        if (!current) return
        setData(loaded)
        setMessage((shown) => (shown === loadFailed ? undefined : shown))
      })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) {
          landed = true
          responses.delete(key).catch(() => {})
        }
        if (!current) return
        if (error instanceof SignedOutError) return
        if (error instanceof NotFoundError) setNotFound(true)
        else setMessage(loadFailed)
      })
    return () => {
      current = false
    }
  }, [key, load, loadFailed, revision])

  return { data, setData, message, setMessage, notFound }
}
