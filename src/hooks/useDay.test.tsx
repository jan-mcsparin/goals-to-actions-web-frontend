import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, checkOffTask, dropTask, getWeek, placeTask, moveTaskToBank, swapTasks, uncheckTask } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { Week } from '../api/types.ts'
import { queued, waitingCount } from '../api/queue.ts'
import { DataRevision } from './dataRevision.ts'
import { useDay, type UseDay } from './useDay.ts'
import { whereIs } from '../test/tasks.ts'
import { checkOffAt } from '../domain/tasks.ts'

vi.mock('../domain/tasks.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/tasks.ts')>()
  return { ...actual, checkOffAt: vi.fn(actual.checkOffAt) }
})

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getWeek: vi.fn(actual.getWeek),
    checkOffTask: vi.fn(actual.checkOffTask),
    uncheckTask: vi.fn(actual.uncheckTask),
    placeTask: vi.fn(actual.placeTask),
    moveTaskToBank: vi.fn(actual.moveTaskToBank),
    swapTasks: vi.fn(actual.swapTasks),
    dropTask: vi.fn(actual.dropTask),
  }
})

const WEDNESDAY = new Date(2026, 10, 11, 9, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY)
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  // Back to the real checkOffAt, the one given to vi.fn.
  vi.mocked(checkOffAt).mockReset()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function statusOf(state: UseDay, taskId: string) {
  const task = state.day?.sections.flatMap((section) => section.rows).find((row) => row.task.id === taskId)?.task
  return task && whereIs(task)
}

async function renderLoaded() {
  const hook = renderHook(() => useDay('2026-11-11', '2026-11-11'))
  await waitFor(() => expect(hook.result.current.day).toBeDefined())
  return hook
}

// Each change goes into the queue: it shows at once, is sent in order, and stays on the
// screen when a send fails, waiting to be tried again.
describe('useDay toggleDone', () => {
  it('sends the moment it shows: one tap, one moment and day', async () => {
    // A clock that moves on with every reading: two readings would disagree.
    let readings = 0
    vi.mocked(checkOffAt).mockImplementation(() => {
      readings += 1
      return { completedAt: `2026-11-11T16:0${readings}:00.000Z`, completedOn: '2026-11-11' }
    })
    vi.mocked(checkOffTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))

    expect(readings).toBe(1)
    const shown = result.current.day?.sections.flatMap((section) => section.rows).find((row) => row.task.id === 'task-laundry')?.task
    await waitFor(() =>
      expect(vi.mocked(checkOffTask)).toHaveBeenLastCalledWith('task-laundry', {
        completedAt: shown?.completedAt,
        completedOn: shown?.completedOn,
      }),
    )
    expect(shown?.completedOn).toBe('2026-11-11')
  })

  it('shows the task done on the tap, before anything is sent', async () => {
    vi.mocked(checkOffTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBe('done')
    expect(result.current.day?.progress).toEqual({ done: 1, total: 4 })
  })

  it('stays done once the save is confirmed and the week read again', async () => {
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))

    await waitFor(() => expect(getWeek).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queued()).toEqual([]))
    expect(statusOf(result.current, 'task-laundry')).toBe('done')
  })

  it('undoes a done task on a second tap, sending both in order', async () => {
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))
    act(() => result.current.toggleDone('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBe('planned')
    await waitFor(() => expect(uncheckTask).toHaveBeenCalledWith('task-laundry'))
    expect(vi.mocked(checkOffTask).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(uncheckTask).mock.invocationCallOrder[0])
  })

  it("keeps the task done, with no message, when the save can't be sent", async () => {
    vi.mocked(checkOffTask).mockRejectedValue(new Error('offline'))
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))

    await waitFor(() => expect(checkOffTask).toHaveBeenCalled())
    expect(statusOf(result.current, 'task-laundry')).toBe('done')
    expect(result.current.message).toBeUndefined()
    expect(waitingCount()).toBe(1)
    vi.mocked(checkOffTask).mockReset()
  })
})

describe('useDay pull', () => {
  it('adds the bank task to today at once, with its goal', async () => {
    vi.mocked(placeTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.pull('task-garage-shelves'))

    expect(statusOf(result.current, 'task-garage-shelves')).toBe('planned')
    const pulled = result.current.day?.sections
      .flatMap((section) => section.rows)
      .find((row) => row.task.id === 'task-garage-shelves')
    expect(pulled?.subline).toBe('Clear out the garage · Keep a calm home')
    expect(result.current.bankRows?.map((row) => row.task.id)).not.toContain('task-garage-shelves')
  })

  it("keeps it on today when the save can't be sent", async () => {
    vi.mocked(placeTask).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()

    act(() => result.current.pull('task-garage-shelves'))

    await waitFor(() => expect(placeTask).toHaveBeenCalled())
    expect(statusOf(result.current, 'task-garage-shelves')).toBe('planned')
    expect(result.current.message).toBeUndefined()
  })
})

function taskIdsInOrder(state: UseDay) {
  return state.day?.sections.flatMap((section) => section.rows.map((row) => row.task.id))
}

describe('useDay sendToBank', () => {
  it('takes the task off today at once', async () => {
    vi.mocked(moveTaskToBank).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.sendToBank('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBeUndefined()
    expect(result.current.day?.progress).toEqual({ done: 0, total: 3 })
  })

  it('sends the week the change was made in', async () => {
    vi.mocked(moveTaskToBank).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.sendToBank('task-laundry'))

    await waitFor(() => expect(moveTaskToBank).toHaveBeenCalledWith('task-laundry', '2026-11-09'))
  })

  it("keeps it in the bank when the save can't be sent", async () => {
    vi.mocked(moveTaskToBank).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()

    act(() => result.current.sendToBank('task-laundry'))

    await waitFor(() => expect(moveTaskToBank).toHaveBeenCalled())
    expect(statusOf(result.current, 'task-laundry')).toBeUndefined()
    expect(result.current.message).toBeUndefined()
  })
})

describe('useDay move', () => {
  it('moves a task to another day of its week at once, and says where it went', async () => {
    vi.mocked(placeTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.move('task-move-car', '2026-11-14'))

    expect(statusOf(result.current, 'task-move-car')).toBeUndefined()
    expect(result.current.message).toBe('Moved to Sat, Nov 14.')
    await waitFor(() => expect(placeTask).toHaveBeenCalledWith('task-move-car', '2026-11-09', '2026-11-14'))
  })

  it('takes a task moved to another week off the day at once, sending the week it was in', async () => {
    vi.mocked(placeTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.move('task-move-car', '2026-12-19'))

    expect(statusOf(result.current, 'task-move-car')).toBeUndefined()
    expect(result.current.message).toBe('Moved to Sat, Dec 19.')
    await waitFor(() => expect(placeTask).toHaveBeenCalledWith('task-move-car', '2026-11-09', '2026-12-19'))
    expect(queued()).toEqual([expect.objectContaining({ kind: 'place', task: expect.objectContaining({ id: 'task-move-car' }) })])
  })
})

describe('useDay removing', () => {
  it('asks, then sends, and the task goes once the server has it', async () => {
    const sent = deferred<Awaited<ReturnType<typeof dropTask>>>()
    vi.mocked(dropTask).mockReturnValueOnce(sent.promise)
    const { result } = await renderLoaded()
    const task = result.current.day!.sections.flatMap((section) => section.rows).find((row) => row.task.id === 'task-move-car')!.task

    act(() => result.current.removing.ask(task))
    expect(result.current.removing.asking).toBe(task)
    let confirmed!: Promise<void>
    act(() => {
      confirmed = result.current.removing.confirm()
    })

    expect(statusOf(result.current, 'task-move-car')).toBe('planned')
    const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts')
    sent.resolve(await actual.dropTask('task-move-car'))
    await act(() => confirmed)
    await waitFor(() => expect(statusOf(result.current, 'task-move-car')).toBeUndefined())
    expect(dropTask).toHaveBeenCalledExactlyOnceWith('task-move-car')
  })

  it("keeps the task when the remove fails, and says so", async () => {
    vi.mocked(dropTask).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()
    const task = result.current.day!.sections.flatMap((section) => section.rows).find((row) => row.task.id === 'task-move-car')!.task

    act(() => result.current.removing.ask(task))
    await act(() => result.current.removing.confirm())

    expect(statusOf(result.current, 'task-move-car')).toBe('planned')
    expect(result.current.message).toBe("Couldn't remove that. Try again.")
  })
})

describe('useDay swap', () => {
  it("puts the bank task in the swapped task's place at once", async () => {
    vi.mocked(swapTasks).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()
    const before = taskIdsInOrder(result.current)

    act(() => result.current.swap('task-ballot', 'task-dentist'))

    expect(taskIdsInOrder(result.current)).toEqual(before?.map((id) => (id === 'task-ballot' ? 'task-dentist' : id)))
    expect(result.current.bankRows?.map((row) => row.task.id)).not.toContain('task-dentist')
  })

  it('sends the week and the day the bank task takes', async () => {
    vi.mocked(swapTasks).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.swap('task-laundry', 'task-dentist'))

    await waitFor(() =>
      expect(swapTasks).toHaveBeenCalledWith('task-laundry', {
        week: '2026-11-09',
        bankTaskId: 'task-dentist',
        day: '2026-11-11',
      }),
    )
  })

  it("keeps both where they went when the save can't be sent", async () => {
    vi.mocked(swapTasks).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()

    act(() => result.current.swap('task-laundry', 'task-dentist'))

    await waitFor(() => expect(swapTasks).toHaveBeenCalled())
    expect(statusOf(result.current, 'task-dentist')).toBe('planned')
    expect(statusOf(result.current, 'task-laundry')).toBeUndefined()
    expect(result.current.message).toBeUndefined()
  })
})

describe('useDay on another day', () => {
  it('pulls a bank task onto that day, placed by hand', async () => {
    const hook = renderHook(() => useDay('2026-11-12', '2026-11-11'))
    await waitFor(() => expect(hook.result.current.day).toBeDefined())

    await act(async () => hook.result.current.pull('task-lift-bank'))

    expect(placeTask).toHaveBeenCalledWith('task-lift-bank', '2026-11-09', '2026-11-12')
    const row = hook.result.current.day?.sections
      .flatMap((section) => section.rows)
      .find((candidate) => candidate.task.id === 'task-lift-bank')
    expect(row?.task).toMatchObject({ plannedDay: '2026-11-12', placedByHand: true })
  })
})

describe('useDay when the data revision changes', () => {
  function renderWithRevision() {
    let revision = 0
    const wrapper = ({ children }: { children: ReactNode }) => <DataRevision value={revision}>{children}</DataRevision>
    const hook = renderHook(() => useDay('2026-11-11', '2026-11-11'), { wrapper })
    return {
      ...hook,
      bump: () => {
        revision += 1
        hook.rerender()
      },
    }
  }

  function titlesOf(state: UseDay) {
    return state.day?.sections.flatMap((section) => section.rows).map((row) => row.task.title)
  }

  it('loads the day again, showing the old one until the new one arrives', async () => {
    const hook = renderWithRevision()
    await waitFor(() => expect(hook.result.current.day).toBeDefined())
    await addTask({ title: 'Call the vet', day: '2026-11-11' })

    act(() => hook.bump())

    expect(hook.result.current.day).toBeDefined()
    await waitFor(() => expect(titlesOf(hook.result.current)).toContain('Call the vet'))
  })

  it('settles on the newest load when two overlap', async () => {
    const hook = renderWithRevision()
    await waitFor(() => expect(hook.result.current.day).toBeDefined())
    // useDay reads the day's week now, not the day.
    const loaded = await getWeek('2026-11-09')
    const onTheDay = loaded.tasks.find((task) => task.plannedDay === '2026-11-11')!
    const withTitle = (title: string): Week => ({ ...loaded, tasks: [{ ...onTheDay, title }] })
    const older = deferred<Week>()
    const newer = deferred<Week>()
    vi.mocked(getWeek).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)

    act(() => hook.bump())
    act(() => hook.bump())
    await act(async () => newer.resolve(withTitle('Newer')))
    await act(async () => older.resolve(withTitle('Older')))

    expect(titlesOf(hook.result.current)).toEqual(['Newer'])
  })
})
