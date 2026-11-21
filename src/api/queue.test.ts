import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, checkOffTask, moveTaskToBank, placeTask, swapTasks, uncheckTask } from './client.ts'
import { NotFoundError, RefusedError, SignedOutError } from './errors.ts'
import {
  enqueue,
  flush,
  installTriggers,
  isStalled,
  loadQueue,
  onEmptied,
  queued,
  resetQueue,
  settle,
  subscribe,
  waitingCount,
} from './queue.ts'
import { afterQueue } from './sendOrder.ts'
import { planStore, resetPlanStore } from '../storage/planStore.ts'
import type { Change } from '../domain/replay.ts'

vi.mock('./client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client.ts')>()
  return {
    ...actual,
    addTask: vi.fn(),
    checkOffTask: vi.fn(),
    uncheckTask: vi.fn(),
    placeTask: vi.fn(),
    moveTaskToBank: vi.fn(),
    swapTasks: vi.fn(),
  }
})

const WEEK = '2026-11-09'
const CHECK_OFF = { completedAt: '2026-11-11T16:00:00.000Z', completedOn: '2026-11-11', valueLogged: null }

const checkOff = (id: string, taskId = 't1'): Change => ({ kind: 'checkOff', id, taskId, checkOff: CHECK_OFF })

const sends = [addTask, checkOffTask, uncheckTask, placeTask, moveTaskToBank, swapTasks]

beforeEach(() => {
  resetPlanStore()
  resetQueue()
  for (const send of sends) vi.mocked(send).mockReset().mockResolvedValue({} as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enqueue and send', () => {
  it('sends each kind as its request', async () => {
    await enqueue(checkOff('c1'))
    await enqueue({ kind: 'uncheck', id: 'c2', taskId: 't1' })
    await enqueue({ kind: 'place', id: 'c3', taskId: 't1', week: WEEK, day: '2026-11-12' })
    await enqueue({ kind: 'toBank', id: 'c4', taskId: 't1', week: WEEK })
    await enqueue({ kind: 'swap', id: 'c5', taskId: 't1', week: WEEK, bankTaskId: 't2', day: '2026-11-12' })
    const task = { title: 'Call the vet', day: null, dueDate: null, goalId: null, timeOfDay: null }
    await enqueue({ kind: 'addTask', id: 'c6', taskId: 't3', task, goalLabel: null, place: { week: WEEK, day: null } })
    await flush()

    expect(checkOffTask).toHaveBeenCalledWith('t1', CHECK_OFF)
    expect(uncheckTask).toHaveBeenCalledWith('t1')
    expect(placeTask).toHaveBeenCalledWith('t1', WEEK, '2026-11-12')
    expect(moveTaskToBank).toHaveBeenCalledWith('t1', WEEK)
    expect(swapTasks).toHaveBeenCalledWith('t1', { week: WEEK, bankTaskId: 't2', day: '2026-11-12' })
    expect(addTask).toHaveBeenCalledWith(task, 't3')
    expect(waitingCount()).toBe(0)
  })

  it('sends one at a time, in order, the next only after the last is answered', async () => {
    const order: string[] = []
    let answerFirst = () => {}
    vi.mocked(checkOffTask).mockImplementation(async (taskId) => {
      order.push(`start ${taskId}`)
      if (taskId === 't1') await new Promise<void>((resolve) => (answerFirst = resolve))
      order.push(`end ${taskId}`)
      return {} as never
    })

    await enqueue(checkOff('c1', 't1'))
    await enqueue(checkOff('c2', 't2'))
    await vi.waitFor(() => expect(order).toEqual(['start t1']))
    answerFirst()
    await flush()

    expect(order).toEqual(['start t1', 'end t1', 'start t2', 'end t2'])
  })

  it('drops a change answered 404 or 409, and goes on with the next', async () => {
    vi.mocked(checkOffTask)
      .mockRejectedValueOnce(new NotFoundError('gone'))
      .mockRejectedValueOnce(new RefusedError('moved on'))
      .mockResolvedValueOnce({} as never)

    await enqueue(checkOff('c1'))
    await enqueue(checkOff('c2'))
    await enqueue(checkOff('c3'))
    await flush()

    expect(checkOffTask).toHaveBeenCalledTimes(3)
    expect(queued().map((change) => change.id)).toEqual(['c3'])
    expect(waitingCount()).toBe(0)
    expect(isStalled()).toBe(false)
  })

  it.each([
    ['no network', new TypeError('Failed to fetch')],
    ['a server error', new Error('POST /tasks/t1/check-off: 500')],
    ['a 422', new Error('POST /tasks/t1/check-off: 422')],
    ['a 403', new Error('POST /tasks/t1/check-off: 403')],
    ['a 401', new SignedOutError('not signed in')],
  ])('keeps the change on %s, and stops sending', async (_, failure) => {
    vi.mocked(checkOffTask).mockRejectedValue(failure)

    await enqueue(checkOff('c1', 't1'))
    await enqueue(checkOff('c2', 't2'))
    await flush()

    // Each new change tries again from the first; the second never goes before it.
    expect(vi.mocked(checkOffTask).mock.calls.map(([taskId]) => taskId).every((taskId) => taskId === 't1')).toBe(true)
    expect(waitingCount()).toBe(2)
    expect(isStalled()).toBe(true)
  })

  it('tries again from the change it stopped at, and is no longer stalled once one goes', async () => {
    vi.mocked(checkOffTask).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await enqueue(checkOff('c1', 't1'))
    await flush()

    await flush()

    expect(vi.mocked(checkOffTask).mock.calls.map(([taskId]) => taskId)).toEqual(['t1', 't1'])
    expect(isStalled()).toBe(false)
    expect(waitingCount()).toBe(0)
  })
})

describe('a change made while the queue is still loading', () => {
  it('is sent without waiting for another trigger', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const kept = planStore().queue.entries
    vi.spyOn(planStore().queue, 'entries').mockImplementation(async () => {
      await gate
      return kept()
    })
    void loadQueue() // a screen loads the queue on mount
    void flush() // and App sends on opening

    const tapped = enqueue(checkOff('c1'))
    release()
    await tapped

    await vi.waitFor(() => expect(checkOffTask).toHaveBeenCalled())
    await vi.waitFor(() => expect(waitingCount()).toBe(0))
  })
})

describe('confirmed changes', () => {
  it('keep being replayed until a week read that started after them lands', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    const readBefore = Date.now()
    vi.setSystemTime(2000)
    await enqueue(checkOff('c1'))
    await flush()

    settle(readBefore)
    expect(queued().map((change) => change.id)).toEqual(['c1'])

    vi.setSystemTime(3000)
    settle(Date.now())
    expect(queued()).toEqual([])
  })

  it('tell the screens when the queue has emptied, so the week is read again', async () => {
    const emptied = vi.fn()
    onEmptied(emptied)

    await enqueue(checkOff('c1'))
    await flush()

    expect(emptied).toHaveBeenCalledTimes(1)
  })
})

describe('kept on the phone', () => {
  it('comes back after a restart, waiting and confirmed alike, in order', async () => {
    vi.mocked(checkOffTask).mockResolvedValueOnce({} as never).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await enqueue(checkOff('c1'))
    await enqueue(checkOff('c2'))
    await flush()

    resetQueue()
    await loadQueue()

    expect(queued().map((change) => change.id)).toEqual(['c1', 'c2'])
    expect(waitingCount()).toBe(1)
  })

  it('forgets a dropped change', async () => {
    vi.mocked(checkOffTask).mockRejectedValueOnce(new RefusedError('moved on'))
    await enqueue(checkOff('c1'))
    await flush()

    expect(await planStore().queue.entries()).toEqual([])
  })

  it('still queues and sends when the phone cannot store it', async () => {
    vi.spyOn(planStore().queue, 'put').mockRejectedValue(new Error('quota'))

    await enqueue(checkOff('c1'))
    await flush()

    expect(checkOffTask).toHaveBeenCalledTimes(1)
  })
})

describe('subscribe', () => {
  it('tells listeners of each change, until they leave', async () => {
    const listener = vi.fn()
    const leave = subscribe(listener)

    await enqueue(checkOff('c1'))
    const heard = listener.mock.calls.length
    leave()
    await flush()

    expect(heard).toBeGreaterThan(0)
    expect(listener).toHaveBeenCalledTimes(heard)
  })
})

describe('other writes wait their turn', () => {
  it('wait for the send under way', async () => {
    let answer = () => {}
    vi.mocked(checkOffTask).mockImplementation(() => new Promise((resolve) => (answer = () => resolve({} as never))))
    const done = vi.fn()

    await enqueue(checkOff('c1'))
    const waiting = afterQueue().then(done)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()

    answer()
    await waiting
    expect(done).toHaveBeenCalled()
  })

  it("go as soon as the queue is stuck, rather than wait on it", async () => {
    vi.mocked(checkOffTask).mockRejectedValue(new TypeError('Failed to fetch'))
    await enqueue(checkOff('c1'))
    await flush()

    await expect(afterQueue()).resolves.toBeUndefined()
  })
})

describe('triggers', () => {
  it('send when the app comes back to the front and when the network is back', async () => {
    const page = new EventTarget() as EventTarget & { visibilityState: string }
    page.visibilityState = 'hidden'
    const network = new EventTarget()
    vi.mocked(checkOffTask).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await enqueue(checkOff('c1'))
    await flush()
    const remove = installTriggers(page, network)

    page.dispatchEvent(new Event('visibilitychange'))
    expect(checkOffTask).toHaveBeenCalledTimes(1)
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(checkOffTask).toHaveBeenCalledTimes(2)

    await enqueue(checkOff('c2'))
    vi.mocked(checkOffTask).mockClear()
    network.dispatchEvent(new Event('online'))
    await flush()
    remove()

    expect(waitingCount()).toBe(0)
  })
})
