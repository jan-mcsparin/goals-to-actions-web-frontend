import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAspiration } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { useAspiration } from './useAspiration.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getAspiration: vi.fn(actual.getAspiration) }
})

const TODAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getAspiration).mockClear()
})

describe('useAspiration', () => {
  it('loads the aspiration and lays out its page', async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))

    await waitFor(() => expect(result.current.page).toBeDefined())
    expect(result.current.page).toMatchObject({ kind: 'active', name: 'Be fit' })
    expect(result.current.notFound).toBe(false)
  })

  it('reports an aspiration that is not there as not found, with no message', async () => {
    const { result } = renderHook(() => useAspiration('asp-gone', TODAY))

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.page).toBeUndefined()
    expect(result.current.message).toBeUndefined()
  })

  it('shows a message when loading fails for another reason', async () => {
    vi.mocked(getAspiration).mockRejectedValueOnce(new Error('offline'))

    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))

    await waitFor(() => expect(result.current.message).toBe("Couldn't load this aspiration. Try again in a moment."))
    expect(result.current.notFound).toBe(false)
  })
})
