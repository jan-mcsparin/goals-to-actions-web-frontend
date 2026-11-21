import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask } from './client.ts'
import { enqueue, loadQueue, queued, resetQueue, waitingCount } from './queue.ts'
import { anythingStored, clearStored } from './stored.ts'
import { SignedOutError } from './errors.ts'
import { planStore, resetPlanStore } from '../storage/planStore.ts'
import type { Change } from '../domain/replay.ts'
import type { Week } from './types.ts'

vi.mock('./client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client.ts')>()),
  checkOffTask: vi.fn(),
}))

const WEEK: Week = { week: '2026-11-16', isCurrent: true, nextWeekOpen: false, tasks: [], goals: [], days: [], quittingGoals: [] }
const CHANGE: Change = {
  kind: 'checkOff',
  id: 'c1',
  taskId: 't1',
  checkOff: { completedAt: '2026-11-20T16:00:00.000Z', completedOn: '2026-11-20', valueLogged: null },
}

beforeEach(() => {
  resetPlanStore()
  resetQueue()
  vi.mocked(checkOffTask).mockReset().mockRejectedValue(new SignedOutError('not signed in'))
})

describe('anythingStored', () => {
  it('is false on a phone with nothing kept', async () => {
    expect(await anythingStored()).toBe(false)
  })

  it.each([
    ['a week', () => planStore().weeks.put(WEEK.week, WEEK)],
    ['a last response', () => planStore().responses.put('settings', {})],
    ['a queued change', () => enqueue(CHANGE)],
  ])('is true with %s', async (_, keep) => {
    await keep()

    expect(await anythingStored()).toBe(true)
  })

  it('is false where the phone cannot store anything', async () => {
    vi.spyOn(planStore().weeks, 'count').mockRejectedValue(new Error('no storage'))

    expect(await anythingStored()).toBe(false)
  })
})

describe('clearStored', () => {
  it('empties every shelf and the queue the app is holding', async () => {
    await planStore().weeks.put(WEEK.week, WEEK)
    await planStore().responses.put('goal/g1', {})
    await enqueue(CHANGE)

    await clearStored()

    expect(await planStore().weeks.entries()).toEqual([])
    expect(await planStore().responses.entries()).toEqual([])
    expect(await planStore().queue.entries()).toEqual([])
    expect(queued()).toEqual([])
    expect(waitingCount()).toBe(0)
  })

  it("doesn't bring the queue back from what was kept", async () => {
    await enqueue(CHANGE)
    resetQueue()

    await clearStored()
    await loadQueue()

    expect(queued()).toEqual([])
  })

  it('still empties the queue when the phone cannot be cleared', async () => {
    await enqueue(CHANGE)
    vi.spyOn(planStore(), 'clear').mockRejectedValue(new Error('no storage'))

    await clearStored()

    expect(queued()).toEqual([])
  })
})
