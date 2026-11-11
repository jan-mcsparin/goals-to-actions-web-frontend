import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, getAspirations, getBank, getDay } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { Task } from '../api/types.ts'
import { addOriginFor, useAdd } from './useAdd.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    addTask: vi.fn(actual.addTask),
    getAspirations: vi.fn(actual.getAspirations),
  }
})

const TODAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(addTask).mockClear()
})

function renderAdd(placement: 'inBank' | 'onToday' = 'inBank') {
  const onSaved = vi.fn()
  const hook = renderHook(() => useAdd({ placement }, TODAY, onSaved))
  return { ...hook, onSaved }
}

describe('addOriginFor', () => {
  it('puts a task on today only from the Today screen', () => {
    expect(addOriginFor({ screen: 'today' })).toEqual({ placement: 'onToday' })
  })

  it.each([
    { screen: 'week' } as const,
    { screen: 'day', date: TODAY } as const,
    { screen: 'aspirations' } as const,
    { screen: 'upkeep' } as const,
    { screen: 'aspiration', aspirationId: 'asp-fit' } as const,
    { screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } } as const,
  ])('puts a task in the bank from $screen', (screen) => {
    expect(addOriginFor(screen)).toEqual({ placement: 'inBank' })
  })
})

describe('useAdd', () => {
  it('starts on the Task tab, blank, in the place it was opened for', () => {
    const { result } = renderAdd('onToday')

    expect(result.current.tab).toBe('task')
    expect(result.current.task).toMatchObject({ title: '', placement: 'onToday' })
    expect(result.current.canSave).toBe(false)
  })

  it('offers the active goals once they load', async () => {
    const { result } = renderAdd()

    await waitFor(() => expect(result.current.goals.length).toBeGreaterThan(0))
    expect(result.current.goals.map((goal) => goal.id)).toContain('goal-strong')
    expect(result.current.goals.map((goal) => goal.id)).not.toContain('goal-cook')
  })

  it('offers no goals, quietly, when they cannot load', async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderAdd()

    await waitFor(() => expect(getAspirations).toHaveBeenCalled())
    expect(result.current.goals).toEqual([])
    expect(result.current.message).toBeUndefined()
  })

  it("saves a title alone to this week's bank and says so", async () => {
    const { result, onSaved } = renderAdd()

    act(() => result.current.editTask({ title: 'Fill out my ballot' }))
    expect(result.current.canSave).toBe(true)
    await act(async () => result.current.save())

    expect(onSaved).toHaveBeenCalledWith("Added to this week's bank.")
    expect((await getBank()).tasks.map((task) => task.title)).toContain('Fill out my ballot')
  })

  it('saves onto today when "On today" is chosen', async () => {
    const { result, onSaved } = renderAdd('onToday')

    act(() => result.current.editTask({ title: 'Call the vet' }))
    await act(async () => result.current.save())

    expect(onSaved).toHaveBeenCalledWith('Added to today.')
    expect((await getDay(TODAY)).tasks.map((task) => task.title)).toContain('Call the vet')
  })

  it('says where a task due in a later week waits', async () => {
    const { result, onSaved } = renderAdd()

    act(() => result.current.editTask({ title: 'Renew passport', dueDate: '2026-11-25' }))
    await act(async () => result.current.save())

    expect(onSaved).toHaveBeenCalledWith('Saved for the week of Nov 23.')
  })

  it('keeps the sheet open with a calm message when the save fails, and can try again', async () => {
    vi.mocked(addTask).mockRejectedValueOnce(new Error('offline'))
    const { result, onSaved } = renderAdd()
    act(() => result.current.editTask({ title: 'Fill out my ballot' }))

    await act(async () => result.current.save())

    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.message).toBe("Couldn't save that. Try again.")
    expect(result.current.task.title).toBe('Fill out my ballot')

    await act(async () => result.current.save())

    expect(onSaved).toHaveBeenCalledWith("Added to this week's bank.")
  })

  it('saves once when Save is tapped twice while the first is on its way', async () => {
    let finish!: (task: Task) => void
    vi.mocked(addTask).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const { result } = renderAdd()
    act(() => result.current.editTask({ title: 'Fill out my ballot' }))

    act(() => void result.current.save())
    expect(result.current.canSave).toBe(false)
    act(() => void result.current.save())
    await act(async () => finish({ id: 't', title: 'Fill out my ballot', status: 'inBank', weekOf: '2026-11-09', rolloverCount: 0 }))

    expect(addTask).toHaveBeenCalledTimes(1)
  })

  it('keeps what was typed when switching tabs', () => {
    const { result } = renderAdd()
    act(() => result.current.editTask({ title: 'Fill out my ballot' }))

    act(() => result.current.setTab('goal'))
    expect(result.current.canSave).toBe(false)
    act(() => result.current.setTab('task'))

    expect(result.current.task.title).toBe('Fill out my ballot')
  })
})
