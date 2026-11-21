// Everything of the person's kept on this phone (ADR-012's list): the week
// documents, the other screens' last responses and the queue. useSession asks
// whether there's any, to tell a session that ended from a first sign-in, and
// clears it all on signing out. The open screen and view choices aren't in it.
import { discardQueue, waitingCount } from './queue.ts'
import { planStore } from '../storage/planStore.ts'

export async function anythingStored(): Promise<boolean> {
  if (waitingCount() > 0) return true
  try {
    const { weeks, responses, queue } = planStore()
    const counts = await Promise.all([weeks.count(), responses.count(), queue.count()])
    return counts.some((count) => count > 0)
  } catch {
    // Nothing readable: nothing to show either.
    return false
  }
}

// A store that can't be cleared still leaves the queue empty for this session.
export async function clearStored(): Promise<void> {
  await Promise.allSettled([discardQueue(), planStore().clear()])
}
