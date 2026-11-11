import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addTask,
  getAspiration,
  getAspirations,
  getDay,
  getGoal,
  getUpkeep,
  getWeek,
  updateAspiration,
} from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { DataRevision, useDataRevision, useRevisionCounter } from './dataRevision.ts'
import { useAspiration } from './useAspiration.ts'
import { useAspirations } from './useAspirations.ts'
import { useDay } from './useDay.ts'
import { useGoal } from './useGoal.ts'
import { useUpkeep } from './useUpkeep.ts'
import { useWeek } from './useWeek.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getDay: vi.fn(actual.getDay),
    getWeek: vi.fn(actual.getWeek),
    getAspirations: vi.fn(actual.getAspirations),
    getAspiration: vi.fn(actual.getAspiration),
    getUpkeep: vi.fn(actual.getUpkeep),
    getGoal: vi.fn(actual.getGoal),
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
})

function renderWithRevision<T>(useHook: () => T) {
  let revision = 0
  const wrapper = ({ children }: { children: ReactNode }) => <DataRevision value={revision}>{children}</DataRevision>
  const hook = renderHook(useHook, { wrapper })
  return {
    ...hook,
    bump: () => {
      revision += 1
      hook.rerender()
    },
  }
}

describe('useDataRevision', () => {
  it('is 0 without a provider', () => {
    const { result } = renderHook(() => useDataRevision())

    expect(result.current).toBe(0)
  })
})

describe('useRevisionCounter', () => {
  it('starts at 0 and goes up by one on each bump', () => {
    const { result } = renderHook(() => useRevisionCounter())

    act(() => result.current.bump())
    act(() => result.current.bump())

    expect(result.current.revision).toBe(2)
  })
})

describe('useWeek when the data revision changes', () => {
  it('loads the week again, showing the old one until the new one arrives', async () => {
    const hook = renderWithRevision(() => useWeek(TODAY))
    await waitFor(() => expect(hook.result.current.week).toBeDefined())
    await addTask({ title: 'Fill out my ballot' })

    act(() => hook.bump())

    expect(hook.result.current.week).toBeDefined()
    await waitFor(() =>
      expect(hook.result.current.week?.bank.map((task) => task.title)).toContain('Fill out my ballot'),
    )
  })
})

describe('useAspirations when the data revision changes', () => {
  it('loads the aspirations again', async () => {
    const hook = renderWithRevision(() => useAspirations())
    await waitFor(() => expect(hook.result.current.view).toBeDefined())
    await updateAspiration('asp-fit', { name: 'Be fitter' })

    act(() => hook.bump())

    expect(hook.result.current.view).toBeDefined()
    await waitFor(() => expect(JSON.stringify(hook.result.current.view)).toContain('Be fitter'))
  })
})

describe.each([
  ['useDay', getDay, () => useDay(TODAY, TODAY)],
  ['useWeek', getWeek, () => useWeek(TODAY)],
  ['useAspirations', getAspirations, () => useAspirations()],
  ['useAspiration', getAspiration, () => useAspiration('asp-fit', TODAY)],
  ['useUpkeep', getUpkeep, () => useUpkeep(TODAY)],
  ['useGoal', getGoal, () => useGoal('goal-strong', { screen: 'aspirations' }, TODAY)],
] as const)('%s after a failed load', (_name, load, useHook) => {
  it('clears the load message once a reload works', async () => {
    vi.mocked(load).mockRejectedValueOnce(new Error('offline'))
    const hook = renderWithRevision<{ message?: string }>(useHook)
    await waitFor(() => expect(hook.result.current.message).toBeDefined())

    act(() => hook.bump())

    await waitFor(() => expect(hook.result.current.message).toBeUndefined())
  })
})
