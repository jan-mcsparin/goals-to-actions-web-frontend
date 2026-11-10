import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask, pullFromBank, skipTask, swapTask, uncheckTask } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { Task } from '../api/types.ts'
import { useToday, type UseToday } from './useToday.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    checkOffTask: vi.fn(actual.checkOffTask),
    uncheckTask: vi.fn(actual.uncheckTask),
    pullFromBank: vi.fn(actual.pullFromBank),
    skipTask: vi.fn(actual.skipTask),
    swapTask: vi.fn(actual.swapTask),
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

function statusOf(state: UseToday, taskId: string) {
  return state.today?.sections
    .flatMap((section) => section.rows)
    .find((row) => row.task.id === taskId)?.task.status
}

async function renderLoaded() {
  const hook = renderHook(() => useToday())
  await waitFor(() => expect(hook.result.current.today).toBeDefined())
  return hook
}

function laundry(status: Task['status']): Task {
  return { id: 'task-laundry', title: 'Laundry', status, weekOf: '2026-11-09', plannedDay: '2026-11-11', rolloverCount: 0 }
}

describe('useToday toggleDone', () => {
  it('shows the task done before the save finishes', async () => {
    const save = deferred<Task>()
    vi.mocked(checkOffTask).mockReturnValueOnce(save.promise)
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBe('done')
    expect(result.current.today?.progress).toEqual({ done: 1, total: 4 })
    await act(async () => save.resolve(laundry('done')))
    expect(statusOf(result.current, 'task-laundry')).toBe('done')
  })

  it('undoes a done task on a second tap', async () => {
    const { result } = await renderLoaded()

    await act(async () => result.current.toggleDone('task-laundry'))
    await act(async () => result.current.toggleDone('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBe('planned')
    expect(uncheckTask).toHaveBeenCalledWith('task-laundry')
  })

  it('puts the task back and says so calmly when the save fails', async () => {
    const save = deferred<Task>()
    vi.mocked(checkOffTask).mockReturnValueOnce(save.promise)
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))
    await act(async () => save.reject(new Error('offline')))

    expect(statusOf(result.current, 'task-laundry')).toBe('planned')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })

  it('settles on the last tap when two taps overlap', async () => {
    const first = deferred<Task>()
    const second = deferred<Task>()
    vi.mocked(checkOffTask).mockReturnValueOnce(first.promise)
    vi.mocked(uncheckTask).mockReturnValueOnce(second.promise)
    const { result } = await renderLoaded()

    act(() => result.current.toggleDone('task-laundry'))
    act(() => result.current.toggleDone('task-laundry'))
    await act(async () => second.resolve(laundry('planned')))
    await act(async () => first.resolve(laundry('done')))

    expect(statusOf(result.current, 'task-laundry')).toBe('planned')
  })
})

describe('useToday pull', () => {
  it('adds the bank task to today at once, with its goal', async () => {
    const save = deferred<Task>()
    vi.mocked(pullFromBank).mockReturnValueOnce(save.promise)
    const { result } = await renderLoaded()
    await act(async () => result.current.loadBank())

    act(() => result.current.pull('task-garage-shelves'))

    expect(statusOf(result.current, 'task-garage-shelves')).toBe('planned')
    const pulled = result.current.today?.sections
      .flatMap((section) => section.rows)
      .find((row) => row.task.id === 'task-garage-shelves')
    expect(pulled?.subline).toBe('Clear out the garage · Keep a calm home')
    expect(result.current.bankRows?.map((row) => row.task.id)).not.toContain('task-garage-shelves')
  })

  it('puts the task back in the bank and says so calmly when the save fails', async () => {
    vi.mocked(pullFromBank).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()
    await act(async () => result.current.loadBank())

    await act(async () => result.current.pull('task-garage-shelves'))

    expect(statusOf(result.current, 'task-garage-shelves')).toBeUndefined()
    expect(result.current.bankRows?.map((row) => row.task.id)).toContain('task-garage-shelves')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })
})

function taskIdsInOrder(state: UseToday) {
  return state.today?.sections.flatMap((section) => section.rows.map((row) => row.task.id))
}

describe('useToday sendToBank', () => {
  it('takes the task off today at once', async () => {
    vi.mocked(skipTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()

    act(() => result.current.sendToBank('task-laundry'))

    expect(statusOf(result.current, 'task-laundry')).toBeUndefined()
    expect(result.current.today?.progress).toEqual({ done: 0, total: 3 })
  })

  it('puts the task back in its place and says so calmly when the save fails', async () => {
    vi.mocked(skipTask).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()
    const before = taskIdsInOrder(result.current)

    await act(async () => result.current.sendToBank('task-laundry'))

    expect(taskIdsInOrder(result.current)).toEqual(before)
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })
})

describe('useToday swap', () => {
  it('puts the bank task in the swapped task\'s place at once', async () => {
    vi.mocked(swapTask).mockReturnValueOnce(new Promise(() => {}))
    const { result } = await renderLoaded()
    await act(async () => result.current.loadBank())
    const before = taskIdsInOrder(result.current)

    act(() => result.current.swap('task-laundry', 'task-dentist'))

    expect(taskIdsInOrder(result.current)).toEqual(
      before?.map((id) => (id === 'task-laundry' ? 'task-dentist' : id)),
    )
    expect(result.current.bankRows?.map((row) => row.task.id)).not.toContain('task-dentist')
  })

  it('undoes both sides and says so calmly when the save fails', async () => {
    vi.mocked(swapTask).mockRejectedValueOnce(new Error('offline'))
    const { result } = await renderLoaded()
    await act(async () => result.current.loadBank())
    const before = taskIdsInOrder(result.current)

    await act(async () => result.current.swap('task-laundry', 'task-dentist'))

    expect(taskIdsInOrder(result.current)).toEqual(before)
    expect(result.current.bankRows?.map((row) => row.task.id)).toContain('task-dentist')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })
})
