// The plan as screens show it (ADR-010): the weeks the phone stored, shown at
// once, then the fresh read, which is stored in turn; with the queue's changes
// replayed on top. The stored weeks are never edited. Reads again on the data
// revision and once the queue has emptied; a read settles the confirmed changes
// it includes. A failed read keeps what's shown and says so.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { SignedOutError } from '../api/errors.ts'
import { onEmptied, settle } from '../api/queue.ts'
import type { Week } from '../api/types.ts'
import { replay } from '../domain/replay.ts'
import { planStore } from '../storage/planStore.ts'
import { useDataRevision } from './dataRevision.ts'
import { useQueue } from './useQueue.ts'

// Which weeks a screen shows: what the phone has of them, and how to read them
// fresh. Must be stable (useMemo or a module constant), like useLoaded's `load`.
export type WeeksRead = {
  stored: () => Promise<Week[]>
  fresh: () => Promise<Week[]>
}

export type StoredWeeks = {
  // Replayed: what the screen shows.
  weeks?: Week[]
  message?: string
  setMessage: Dispatch<SetStateAction<string | undefined>>
  // Weeks the server sent back from a write (wrap-up): shown and stored.
  keep: (weeks: Week[]) => void
}

type FromServer = { read: WeeksRead; weeks: Week[] }

export function useStoredWeeks(read: WeeksRead, loadFailed: string): StoredWeeks {
  const [server, setServer] = useState<FromServer>()
  const [message, setMessage] = useState<string>()
  const [emptied, setEmptied] = useState(0)
  const revision = useDataRevision()
  const { changes } = useQueue()

  useEffect(() => onEmptied(() => setEmptied((count) => count + 1)), [])

  useEffect(() => {
    let current = true
    read
      .stored()
      .then((weeks) => {
        if (!current || weeks.length === 0) return
        setServer((shown) => (shown?.read === read ? shown : { read, weeks }))
      })
      .catch(() => {
        // Nothing stored to show; the fresh read will be.
      })

    const startedAt = Date.now()
    read
      .fresh()
      .then((weeks) => {
        if (!current) return
        setServer({ read, weeks })
        store(weeks)
        settle(startedAt)
        setMessage((shown) => (shown === loadFailed ? undefined : shown))
      })
      .catch((error: unknown) => {
        if (!current || error instanceof SignedOutError) return
        setMessage(loadFailed)
      })
    return () => {
      current = false
    }
  }, [read, revision, emptied, loadFailed])

  const keep = useCallback(
    (weeks: Week[]) => {
      setServer({ read, weeks })
      store(weeks)
    },
    [read],
  )

  const shown = server?.read === read ? server.weeks : undefined
  return { weeks: shown?.map((week) => replay(week, changes)), message, setMessage, keep }
}

// A copy for next time; if it can't be written, the screen still has it.
function store(weeks: Week[]) {
  for (const week of weeks) {
    planStore()
      .weeks.put(week.week, week)
      .catch(() => {})
  }
}
