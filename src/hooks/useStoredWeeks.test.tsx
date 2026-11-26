import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask } from '../api/client.ts'
import { SignedOutError } from '../api/errors.ts'
import { enqueue, flush, queued, resetQueue } from '../api/queue.ts'
import type { Task, Week } from '../api/types.ts'
import { planStore, resetPlanStore } from '../storage/planStore.ts'
import { aTask } from '../test/tasks.ts'
import { DataRevision } from './dataRevision.ts'
import { useStoredWeeks, type WeeksRead } from './useStoredWeeks.ts'
import { aWeekRead } from '../test/weeks.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, checkOffTask: vi.fn() }
})

const WEEK = '2026-11-09'
const LOAD_FAILED = "Couldn't load today."
const CHECK_OFF = { completedAt: '2026-11-11T16:00:00.000Z', completedOn: '2026-11-11', valueLogged: null }

function aWeek(tasks: Task[]): Week {
  return aWeekRead({ week: WEEK, tasks })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const laundry = aTask('laundry', { plannedDay: '2026-11-11' })

function reading(fresh: () => Promise<Week[]>): WeeksRead {
  return { stored: async () => [(await planStore().weeks.get(WEEK))!].filter(Boolean), fresh }
}

function titlesOf(weeks: Week[] | undefined) {
  return weeks?.[0].tasks.map((task) => task.title)
}

beforeEach(() => {
  resetPlanStore()
  resetQueue()
  vi.mocked(checkOffTask).mockReset().mockResolvedValue({} as never)
})

describe('useStoredWeeks', () => {
  it('shows the stored week first, then the fresh one, and keeps the fresh one', async () => {
    await planStore().weeks.put(WEEK, aWeek([aTask('stored', { title: 'As it was' })]))
    const answer = deferred<Week[]>()
    const read = reading(() => answer.promise)

    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))

    await waitFor(() => expect(titlesOf(result.current.weeks)).toEqual(['As it was']))
    await act(async () => answer.resolve([aWeek([aTask('fresh', { title: 'As it is' })])]))
    expect(titlesOf(result.current.weeks)).toEqual(['As it is'])
    expect((await planStore().weeks.get(WEEK))?.tasks[0].title).toBe('As it is')
  })

  it('replays the queue on top, and the stored week stays as the server sent it', async () => {
    vi.mocked(checkOffTask).mockReturnValue(new Promise(() => {}))
    const read = reading(async () => [aWeek([laundry])])
    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))
    await waitFor(() => expect(result.current.weeks).toBeDefined())

    await act(async () => enqueue({ kind: 'checkOff', id: 'c1', taskId: 'laundry', checkOff: CHECK_OFF }))

    expect(result.current.weeks?.[0].tasks[0].state).toBe('done')
    expect((await planStore().weeks.get(WEEK))?.tasks[0].state).toBe('open')
  })

  it('reads again once the queue has emptied, and settles what that read includes', async () => {
    const fresh = vi.fn(async () => [aWeek([laundry])])
    const read = reading(fresh)
    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))
    await waitFor(() => expect(result.current.weeks).toBeDefined())

    await act(async () => {
      await enqueue({ kind: 'checkOff', id: 'c1', taskId: 'laundry', checkOff: CHECK_OFF })
      await flush()
    })

    await waitFor(() => expect(fresh).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queued()).toEqual([]))
  })

  it('reads again when the data revision changes', async () => {
    const fresh = vi.fn(async () => [aWeek([laundry])])
    const read = reading(fresh)
    let revision = 0
    const wrapper = ({ children }: { children: ReactNode }) => <DataRevision value={revision}>{children}</DataRevision>
    const { rerender } = renderHook(() => useStoredWeeks(read, LOAD_FAILED), { wrapper })
    await waitFor(() => expect(fresh).toHaveBeenCalledTimes(1))

    revision = 1
    rerender()

    await waitFor(() => expect(fresh).toHaveBeenCalledTimes(2))
  })

  it('keeps showing the stored week when the fresh read fails, and says so', async () => {
    await planStore().weeks.put(WEEK, aWeek([laundry]))
    const read = reading(async () => {
      throw new TypeError('Failed to fetch')
    })

    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
    expect(titlesOf(result.current.weeks)).toEqual(['laundry'])
  })

  it('says nothing when signed out: the sign-in page is the message', async () => {
    const read = reading(async () => {
      throw new SignedOutError('not signed in')
    })

    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))

    await act(async () => {})
    expect(result.current.message).toBeUndefined()
  })

  it('keeps a week the server sent back from a write, such as a wrap-up', async () => {
    const read = reading(async () => [aWeek([laundry])])
    const { result } = renderHook(() => useStoredWeeks(read, LOAD_FAILED))
    await waitFor(() => expect(result.current.weeks).toBeDefined())

    const wrapped = { ...aWeek([]), week: '2026-11-16' }
    act(() => result.current.keep([wrapped]))

    expect(result.current.weeks?.[0].week).toBe('2026-11-16')
    await waitFor(async () => expect(await planStore().weeks.get('2026-11-16')).toEqual(wrapped))
  })
})
