import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addAspiration, addGoal, addTask, getAspirations, getBank, getDay, getGoal } from '../api/client.ts'
import { resetStore, store } from '../api/mockStore.ts'
import type { Task } from '../api/types.ts'
import { NEW_ASPIRATION } from '../domain/add.ts'
import { addOriginFor, useAdd, type AddOrigin } from './useAdd.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    addAspiration: vi.fn(actual.addAspiration),
    addGoal: vi.fn(actual.addGoal),
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
  vi.mocked(addGoal).mockClear()
  vi.mocked(addAspiration).mockClear()
})

function renderAdd(placement: 'inBank' | 'onToday' = 'inBank', opening: Partial<AddOrigin> = {}) {
  const onSaved = vi.fn()
  const onChanged = vi.fn()
  const hook = renderHook(() => useAdd({ placement, ...opening }, TODAY, { onSaved, onChanged }))
  return { ...hook, onSaved, onChanged }
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

  it("says so under the picker when the goals can't load, and still saves", async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    const { result, onSaved } = renderAdd()

    await waitFor(() => expect(result.current.goalsMessage).toBe("Couldn't load your goals. Try again in a moment."))
    expect(result.current.goals).toEqual([])
    expect(result.current.message).toBeUndefined()

    act(() => result.current.editTask({ title: 'Fill out my ballot' }))
    await act(async () => result.current.save())
    expect(onSaved).toHaveBeenCalledWith("Added to this week's bank.")
  })

  it('has no goals message once the goals load', async () => {
    const { result } = renderAdd()

    await waitFor(() => expect(result.current.goals.length).toBeGreaterThan(0))
    expect(result.current.goalsMessage).toBeUndefined()
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

describe('useAdd on the Goal tab', () => {
  const BE_STRONG = { type: 'building' as const, sentence: 'Be strong 2: bench 185' }

  function onGoalTab() {
    const added = renderAdd()
    act(() => added.result.current.setTab('goal'))
    return added
  }

  it('offers the active aspirations once they load, in priority order', async () => {
    const { result } = onGoalTab()

    await waitFor(() => expect(result.current.aspirations.length).toBeGreaterThan(0))
    expect(result.current.aspirations).toEqual([
      { id: 'asp-fit', label: 'Be fit' },
      { id: 'asp-home', label: 'Keep a calm home' },
    ])
  })

  it("says so under the picker when the aspirations can't load", async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    const { result } = onGoalTab()

    await waitFor(() => expect(result.current.aspirationsMessage).toBe("Couldn't load your aspirations. Try again in a moment."))
  })

  it('can save once a type, a label and a line are in', () => {
    const { result } = onGoalTab()
    expect(result.current.canSave).toBe(false)

    act(() => result.current.editGoal({ sentence: 'Be strong 2: bench 185' }))
    expect(result.current.canSave).toBe(false)
    act(() => result.current.editGoal({ type: 'building' }))

    expect(result.current.canSave).toBe(true)
  })

  it("opens the goal from its aspiration's page when saved under one", async () => {
    const { result, onSaved } = onGoalTab()
    act(() => result.current.editGoal({ ...BE_STRONG, aspirationId: 'asp-fit' }))

    await act(async () => result.current.save())

    const goal = store.goals.find((row) => row.label === 'Be strong 2')!
    expect(goal.aspirationId).toBe('asp-fit')
    expect(onSaved).toHaveBeenCalledWith("Saved. Add milestones when you're ready.", {
      screen: 'goal',
      goalId: goal.id,
      from: { screen: 'aspiration', aspirationId: 'asp-fit' },
    })
  })

  it('opens the goal from the Aspirations tab when it has no aspiration', async () => {
    const { result, onSaved } = onGoalTab()
    act(() => result.current.editGoal({ type: 'oneOff', sentence: 'Paint the fence: both sides' }))

    await act(async () => result.current.save())

    const goal = store.goals.find((row) => row.label === 'Paint the fence')!
    expect(onSaved).toHaveBeenCalledWith("Saved. Add steps when you're ready.", {
      screen: 'goal',
      goalId: goal.id,
      from: { screen: 'aspirations' },
    })
  })

  it('creates a new aspiration and the goal under it', async () => {
    const { result, onSaved } = onGoalTab()
    act(() => result.current.editGoal({ ...BE_STRONG, aspirationId: NEW_ASPIRATION, newAspirationName: 'Be generous' }))

    await act(async () => result.current.save())

    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    const goal = store.goals.find((row) => row.label === 'Be strong 2')!
    expect(goal.aspirationId).toBe(aspiration.id)
    expect((await getGoal(goal.id)).aspiration?.name).toBe('Be generous')
    expect(onSaved).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ from: { screen: 'aspiration', aspirationId: aspiration.id } }))
  })

  it("selects the new aspiration when the goal then fails, so trying again doesn't make a second", async () => {
    vi.mocked(addGoal).mockRejectedValueOnce(new Error('offline'))
    const { result, onSaved } = onGoalTab()
    await waitFor(() => expect(result.current.aspirations.length).toBeGreaterThan(0))
    act(() => result.current.editGoal({ ...BE_STRONG, aspirationId: NEW_ASPIRATION, newAspirationName: 'Be generous' }))

    await act(async () => result.current.save())

    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.message).toBe("Couldn't save that. Try again.")
    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    expect(result.current.goal.aspirationId).toBe(aspiration.id)
    expect(result.current.aspirations).toContainEqual({ id: aspiration.id, label: 'Be generous' })

    await act(async () => result.current.save())

    expect(addAspiration).toHaveBeenCalledTimes(1)
    expect(store.goals.find((row) => row.label === 'Be strong 2')?.aspirationId).toBe(aspiration.id)
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it("adds a building goal's weekly target and its bank tasks", async () => {
    const { result } = onGoalTab()
    act(() => result.current.editGoal({ ...BE_STRONG, target: { amount: '3', unit: 'lifting sessions' } }))

    await act(async () => result.current.save())

    expect((await getBank()).tasks.filter((task) => task.title === 'Be strong 2')).toHaveLength(3)
  })

  it('keeps the goal typed when switching tabs', () => {
    const { result } = onGoalTab()
    act(() => result.current.editGoal(BE_STRONG))

    act(() => result.current.setTab('task'))
    act(() => result.current.setTab('goal'))

    expect(result.current.goal).toMatchObject(BE_STRONG)
  })
})

describe('useAdd opened for an aspiration', () => {
  it('starts on the Goal tab with that aspiration selected', () => {
    const { result } = renderAdd('inBank', { tab: 'goal', aspirationId: 'asp-fit' })

    expect(result.current.tab).toBe('goal')
    expect(result.current.goal.aspirationId).toBe('asp-fit')
  })
})

describe('useAdd on the Aspiration tab', () => {
  function onAspirationTab() {
    const added = renderAdd()
    act(() => added.result.current.setTab('aspiration'))
    return added
  }

  it('can save once there is a name', () => {
    const { result } = onAspirationTab()
    expect(result.current.canSave).toBe(false)

    act(() => result.current.editAspiration({ why: 'So the people I love feel it' }))
    expect(result.current.canSave).toBe(false)
    act(() => result.current.editAspiration({ name: 'Be generous' }))

    expect(result.current.canSave).toBe(true)
  })

  it('saves without a why, stays open on it, and lets the screen behind reload', async () => {
    const { result, onSaved, onChanged } = onAspirationTab()
    await waitFor(() => expect(result.current.aspirations.length).toBeGreaterThan(0))
    act(() => result.current.editAspiration({ name: 'Be generous' }))

    await act(async () => result.current.save())

    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    expect(aspiration.why).toBeUndefined()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(result.current.savedAspiration).toEqual({ id: aspiration.id, label: 'Be generous' })
    expect(result.current.aspirations).toContainEqual({ id: aspiration.id, label: 'Be generous' })
    expect(result.current.aspiration).toEqual({ name: '', why: '' })
  })

  it('opens the Goal tab with the new aspiration selected', async () => {
    const { result } = onAspirationTab()
    act(() => result.current.editAspiration({ name: 'Be generous', why: 'So the people I love feel it' }))
    await act(async () => result.current.save())

    act(() => result.current.addGoalForSaved())

    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    expect(result.current.tab).toBe('goal')
    expect(result.current.goal.aspirationId).toBe(aspiration.id)
    expect(result.current.savedAspiration).toBeUndefined()
  })

  it('keeps the sheet on the form with a calm message when the save fails', async () => {
    vi.mocked(addAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result, onChanged } = onAspirationTab()
    act(() => result.current.editAspiration({ name: 'Be generous' }))

    await act(async () => result.current.save())

    expect(onChanged).not.toHaveBeenCalled()
    expect(result.current.savedAspiration).toBeUndefined()
    expect(result.current.message).toBe("Couldn't save that. Try again.")
    expect(result.current.aspiration.name).toBe('Be generous')
  })
})
