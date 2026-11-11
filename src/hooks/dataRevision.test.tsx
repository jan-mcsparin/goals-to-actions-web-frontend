import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, updateAspiration } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { DataRevision, useDataRevision, useRevisionCounter } from './dataRevision.ts'
import { useAspirations } from './useAspirations.ts'
import { useWeek } from './useWeek.ts'

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
