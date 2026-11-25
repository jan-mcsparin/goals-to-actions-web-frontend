// Loads a screen's records, and loads them again when `load` or the data
// revision changes, keeping what's shown meanwhile. Only the newest load lands.
// The screen's one message slot lives here too: a failed load fills it, and a
// later load that works clears it, but leaves a save message alone (the reload
// doesn't redo the save). A record that isn't there is reported as notFound, and
// `forget()` drops the kept response once the record has been deleted (spec 038).
// Signed out says nothing here: the sign-in page is the message.
//
// Each read's last response is kept on the phone under `key` (ADR-010), so the
// screen opens from it at once and reads offline; the fresh load replaces it
// when it lands. What the screen shows is what's kept, saves included, so it
// reopens as it was left. The store is only a copy: when it fails, the screen
// works without it.
//
// `reload()` reads the record again, as after a failed save, the same way: the
// newest read lands, and a failed one keeps what's shown. A failed load never
// replaces a message already showing, such as a failed save's.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { NotFoundError, SignedOutError } from '../api/client.ts'
import { planStore } from '../storage/planStore.ts'
import { useDataRevision } from './dataRevision.ts'

export type Loaded<T> = {
  data?: T
  setData: Dispatch<SetStateAction<T | undefined>>
  message?: string
  setMessage: Dispatch<SetStateAction<string | undefined>>
  notFound: boolean
  reload: () => Promise<void>
  forget: () => Promise<void>
}

// `load` must be stable: a module function, or wrapped in useCallback with the
// ids it reads, so it changes only when the screen shows something else. `key`
// names the read and its id, such as `goal/<id>`, and changes with `load`.
export function useLoaded<T>(key: string, load: () => Promise<T>, loadFailed: string): Loaded<T> {
  const [data, setData] = useState<T>()
  // The key `data` came from: until the new key's data arrives, what's shown
  // still belongs to the old one, and is never kept under the new.
  const [dataKey, setDataKey] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const revision = useDataRevision()
  // Counts every read, so only the newest one lands.
  const newestRead = useRef(0)

  const landed = useCallback(
    (loaded: T) => {
      setData(loaded)
      setDataKey(key)
      setMessage((shown) => (shown === loadFailed ? undefined : shown))
    },
    [key, loadFailed],
  )

  const failed = useCallback(
    (error: unknown) => {
      if (error instanceof SignedOutError) return
      if (error instanceof NotFoundError) setNotFound(true)
      else setMessage((shown) => shown ?? loadFailed)
    },
    [loadFailed],
  )

  const forgetIfGone = useCallback(
    (error: unknown) => {
      if (error instanceof NotFoundError) planStore().responses.delete(key).catch(() => {})
    },
    [key],
  )

  async function reload() {
    const read = ++newestRead.current
    try {
      const loaded = await load()
      if (read === newestRead.current) landed(loaded)
    } catch (error) {
      forgetIfGone(error)
      if (read === newestRead.current) failed(error)
    }
  }

  useEffect(() => {
    const read = ++newestRead.current
    let current = true
    // Only a fresh response, or word that the record is gone, outranks the
    // stored one; a failed load (as offline, often before the store has
    // answered) leaves the stored one to show.
    let freshArrived = false
    const { responses } = planStore()
    responses
      .get(key)
      .then((stored) => {
        if (!current || freshArrived || stored === undefined) return
        setData((shown) => shown ?? (stored as T))
        setDataKey((shownKey) => shownKey ?? key)
      })
      .catch(() => {})
    load()
      .then((loaded) => {
        freshArrived = true
        if (current && read === newestRead.current) landed(loaded)
      })
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) freshArrived = true
        forgetIfGone(error)
        if (current && read === newestRead.current) failed(error)
      })
    return () => {
      current = false
    }
  }, [key, load, revision, landed, failed, forgetIfGone])

  useEffect(() => {
    if (dataKey === undefined || data === undefined) return
    planStore().responses.put(dataKey, data).catch(() => {})
  }, [dataKey, data])

  async function forget() {
    ++newestRead.current // a read still on its way lands nothing
    await planStore().responses.delete(key).catch(() => {})
  }

  return { data, setData, message, setMessage, notFound, reload, forget }
}
