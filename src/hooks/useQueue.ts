// The queue as screens see it: the changes to replay, how many wait, and
// whether a send failed. Reads what the phone kept on first use.
import { useEffect, useSyncExternalStore } from 'react'
import { loadQueue, queueState, subscribe, type QueueState } from '../api/queue.ts'

export function useQueue(): QueueState {
  useEffect(() => {
    void loadQueue()
  }, [])
  return useSyncExternalStore(subscribe, queueState)
}
