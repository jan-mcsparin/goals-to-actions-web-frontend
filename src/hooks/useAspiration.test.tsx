import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAspiration, moveAspiration, retireAspiration, reviewAspiration, updateAspiration } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { ActivePage } from '../domain/aspiration.ts'
import { useAspiration } from './useAspiration.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getAspiration: vi.fn(actual.getAspiration),
    moveAspiration: vi.fn(actual.moveAspiration),
    updateAspiration: vi.fn(actual.updateAspiration),
    retireAspiration: vi.fn(actual.retireAspiration),
    reviewAspiration: vi.fn(actual.reviewAspiration),
  }
})

function priorityOf(page: unknown) {
  return (page as ActivePage).priority
}

const TODAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getAspiration).mockClear()
  vi.mocked(moveAspiration).mockClear()
  vi.mocked(updateAspiration).mockClear()
  vi.mocked(retireAspiration).mockClear()
  vi.mocked(reviewAspiration).mockClear()
})

describe('useAspiration, editing', () => {
  it('trims the name and why at once, and drops a blank why', async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.edit({ name: '  Be fit for life ', why: '   ' }))

    expect(result.current.page).toMatchObject({ name: 'Be fit for life' })
    expect(result.current.page).not.toHaveProperty('why')
    await waitFor(() => expect(updateAspiration).toHaveBeenCalledWith('asp-fit', { name: '  Be fit for life ', why: '   ' }))
  })

  it('goes back to the old name, with a message, when the save fails', async () => {
    vi.mocked(updateAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.edit({ name: 'Be fit for life', why: '' }))

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
    expect(result.current.page).toMatchObject({ name: 'Be fit', why: expect.stringMatching(/^So I can keep skiing/) })
  })
})

describe('useAspiration, reviewing', () => {
  it('records the review without waiting', async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.review())

    expect(reviewAspiration).toHaveBeenCalledWith('asp-fit')
    expect(result.current.message).toBeUndefined()
  })

  it('shows a message when the review fails to save', async () => {
    vi.mocked(reviewAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.review())

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
  })
})

describe('useAspiration, retiring', () => {
  it('waits for the save, then reports it worked', async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    let worked: boolean | undefined
    await act(async () => {
      worked = await result.current.retire('pause')
    })

    expect(worked).toBe(true)
    expect(retireAspiration).toHaveBeenCalledWith('asp-fit', 'pause')
  })

  it('stays as it was, with a message, when the save fails', async () => {
    vi.mocked(retireAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    let worked: boolean | undefined
    await act(async () => {
      worked = await result.current.retire('keep')
    })

    expect(worked).toBe(false)
    expect(result.current.message).toBe("Couldn't save that. Try again.")
    expect(result.current.page?.kind).toBe('active')
  })
})

describe('useAspiration, moving', () => {
  it('moves at once, before the save finishes', async () => {
    let finishSave: () => void = () => {}
    vi.mocked(moveAspiration).mockImplementationOnce(
      () => new Promise((resolve) => (finishSave = () => resolve([]))),
    )
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.move('down'))

    expect(priorityOf(result.current.page)).toMatchObject({ line: '2nd of 2 aspirations', canMoveDown: false })
    await act(async () => finishSave())
  })

  it('goes back to where it was, with a message, when the save fails', async () => {
    vi.mocked(moveAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.move('down'))

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
    expect(priorityOf(result.current.page).line).toBe('1st of 2 aspirations')
  })

  it("does nothing when the move doesn't apply", async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.move('up'))

    expect(moveAspiration).not.toHaveBeenCalled()
    expect(priorityOf(result.current.page).line).toBe('1st of 2 aspirations')
  })
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
