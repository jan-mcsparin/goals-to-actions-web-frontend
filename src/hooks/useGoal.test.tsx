import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addMilestone, getGoal, setWeeklyTarget } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { CurrentPage } from '../domain/goalDetail.ts'
import { useGoal } from './useGoal.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getGoal: vi.fn(actual.getGoal),
    setWeeklyTarget: vi.fn(actual.setWeeklyTarget),
    addMilestone: vi.fn(actual.addMilestone),
  }
})

const TODAY = '2026-11-11'
const FROM_TAB = { screen: 'aspirations' } as const

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getGoal).mockClear()
  vi.mocked(setWeeklyTarget).mockClear()
  vi.mocked(addMilestone).mockClear()
})

function shownKinds(rows: { kind: string }[]) {
  return rows.map((row) => row.kind)
}

describe('useGoal, loading', () => {
  it('loads the goal as a page, with back named for where it came from', async () => {
    const { result } = renderHook(() => useGoal('goal-strong', { screen: 'aspiration', aspirationId: 'asp-fit' }, TODAY))

    await waitFor(() => expect(result.current.page).toBeDefined())
    expect(result.current.page?.header.label).toBe('Be strong')
    expect(result.current.backTo).toBe('Be fit')
    expect(result.current.notFound).toBe(false)
  })

  it('reports a goal that isn’t there as not found, with no message', async () => {
    const { result } = renderHook(() => useGoal('goal-gone', FROM_TAB, TODAY))

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.message).toBeUndefined()
  })

  it('shows a calm message when loading fails', async () => {
    vi.mocked(getGoal).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useGoal('goal-strong', FROM_TAB, TODAY))

    await waitFor(() => expect(result.current.message).toBe("Couldn't load this goal. Try again in a moment."))
    expect(result.current.notFound).toBe(false)
  })
})

describe('useGoal, timeline', () => {
  it('starts condensed when the goal has more than four milestones', async () => {
    const { result } = renderHook(() => useGoal('goal-strong', FROM_TAB, TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    expect(result.current.timeline).toMatchObject({ condensable: true, expanded: false, showAllLabel: 'Show all 6' })
    expect(shownKinds(result.current.timeline!.rows)).toContain('fold')
  })

  it('expands and collapses, and remembers the choice for the goal', async () => {
    const first = renderHook(() => useGoal('goal-strong', FROM_TAB, TODAY))
    await waitFor(() => expect(first.result.current.page).toBeDefined())

    act(() => first.result.current.expand())

    expect(first.result.current.timeline?.expanded).toBe(true)
    expect(shownKinds(first.result.current.timeline!.rows)).not.toContain('fold')
    first.unmount()

    const second = renderHook(() => useGoal('goal-strong', FROM_TAB, TODAY))
    await waitFor(() => expect(second.result.current.page).toBeDefined())
    expect(second.result.current.timeline?.expanded).toBe(true)

    act(() => second.result.current.collapse())
    expect(shownKinds(second.result.current.timeline!.rows)).toContain('fold')
  })

  it('shows every row, with nothing to toggle, for four milestones or fewer', async () => {
    const { result } = renderHook(() => useGoal('goal-endurance', FROM_TAB, TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    expect(result.current.timeline?.condensable).toBe(false)
    expect(shownKinds(result.current.timeline!.rows)).not.toContain('fold')
  })
})

describe('useGoal, saving', () => {
  async function loaded(goalId = 'goal-strong') {
    const hook = renderHook(() => useGoal(goalId, FROM_TAB, TODAY))
    await waitFor(() => expect(hook.result.current.page).toBeDefined())
    return hook
  }

  function targetLine(page: unknown) {
    return (page as CurrentPage).target?.line
  }

  it('starts the target sheet from the target in force', async () => {
    const { result } = await loaded()

    expect(result.current.targetDraft).toEqual({ amount: '3', unit: 'lifting sessions' })
  })

  it('shows a new target at once and saves it', async () => {
    const { result } = await loaded()

    act(() => result.current.setTarget({ amount: '4', unit: 'lifting sessions' }))

    expect(targetLine(result.current.page)).toBe('4 lifting sessions')
    await waitFor(() => expect(setWeeklyTarget).toHaveBeenCalledWith('goal-strong', 4, 'lifting sessions'))
  })

  it('ignores a target that can’t be saved', async () => {
    const { result } = await loaded()

    act(() => result.current.setTarget({ amount: '0', unit: 'lifting sessions' }))

    expect(targetLine(result.current.page)).toBe('3 lifting sessions')
    expect(setWeeklyTarget).not.toHaveBeenCalled()
  })

  it('adds a milestone last at once, then keeps the saved one', async () => {
    const { result } = await loaded()

    act(() => result.current.addMilestone({ measurableLine: 'Bench 172', targetDate: '' }))

    expect(result.current.page?.timeline.count).toBe('1 of 7 hit')
    await waitFor(() => expect(addMilestone).toHaveBeenCalledWith('goal-strong', { measurableLine: 'Bench 172' }))
    await waitFor(() => {
      const last = result.current.page?.timeline.rows.at(-2)
      expect(last).toMatchObject({ kind: 'milestone', measurableLine: 'Bench 172' })
      expect((last as { milestoneId: string }).milestoneId).toMatch(/^ms-/)
    })
  })

  it('reloads the goal and says so every time a save fails', async () => {
    vi.mocked(setWeeklyTarget).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(addMilestone).mockRejectedValueOnce(new Error('offline'))
    const { result } = await loaded()

    act(() => result.current.setTarget({ amount: '4', unit: 'lifting sessions' }))
    act(() => result.current.addMilestone({ measurableLine: 'Bench 172', targetDate: '' }))

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
    await waitFor(() => {
      expect(targetLine(result.current.page)).toBe('3 lifting sessions')
      expect(result.current.page?.timeline.count).toBe('1 of 6 hit')
    })
    expect(vi.mocked(getGoal).mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
