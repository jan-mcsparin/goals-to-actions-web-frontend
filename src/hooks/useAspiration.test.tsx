import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bringBackAspiration,
  getAspiration,
  moveAspiration,
  retireAspiration,
  updateAspiration,
} from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { ActivePage } from '../domain/aspiration.ts'
import { useAspiration } from './useAspiration.ts'
import { useFleetingMessage } from './useFleetingMessage.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getAspiration: vi.fn(actual.getAspiration),
    moveAspiration: vi.fn(actual.moveAspiration),
    updateAspiration: vi.fn(actual.updateAspiration),
    retireAspiration: vi.fn(actual.retireAspiration),
    bringBackAspiration: vi.fn(actual.bringBackAspiration),
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
  vi.mocked(bringBackAspiration).mockClear()
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

describe('useAspiration, bringing back', () => {
  it('waits for the save, then shows it active and last', async () => {
    const { result } = renderHook(() => useAspiration('asp-spanish', TODAY))
    await waitFor(() => expect(result.current.page?.kind).toBe('retired'))

    await act(async () => result.current.bringBack())

    expect(result.current.page?.kind).toBe('active')
    expect(priorityOf(result.current.page).line).toBe('3rd of 3 aspirations')
  })

  it('brings it back once when tapped twice quickly, with no message', async () => {
    const { result } = renderHook(() => useAspiration('asp-spanish', TODAY))
    await waitFor(() => expect(result.current.page?.kind).toBe('retired'))

    await act(async () => {
      await Promise.all([result.current.bringBack(), result.current.bringBack()])
    })

    expect(bringBackAspiration).toHaveBeenCalledTimes(1)
    expect(result.current.page?.kind).toBe('active')
    expect(result.current.message).toBeUndefined()
  })

  it('stays retired, with a message, when the save fails', async () => {
    vi.mocked(bringBackAspiration).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useAspiration('asp-spanish', TODAY))
    await waitFor(() => expect(result.current.page?.kind).toBe('retired'))

    await act(async () => result.current.bringBack())

    expect(result.current.page?.kind).toBe('retired')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAspiration, saves that overlap', () => {
  it("ends on the API's aspiration, with a message, when an edit fails after a later save worked", async () => {
    const editing = deferred<never>()
    vi.mocked(updateAspiration).mockReturnValueOnce(editing.promise)
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    act(() => result.current.edit({ name: 'Be fit for life', why: '' }))
    await act(async () => result.current.move('down'))
    await act(async () => editing.reject(new Error('offline')))

    await waitFor(() => expect(result.current.page).toMatchObject({ name: 'Be fit' }))
    expect(priorityOf(result.current.page).line).toBe('2nd of 2 aspirations')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })

  it("ends on the API's order when two moves go at the same instant", async () => {
    const { result } = renderHook(() => useAspiration('asp-fit', TODAY))
    await waitFor(() => expect(result.current.page).toBeDefined())

    // Both read the same page; the API refuses the second, as it's already last.
    await act(async () => {
      result.current.move('down')
      result.current.move('down')
    })

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
    await waitFor(() => expect(priorityOf(result.current.page).line).toBe('2nd of 2 aspirations'))
  })

  it('shows the message for each of two saves failing more than 5 s apart', async () => {
    const editing = deferred<never>()
    const moving = deferred<never>()
    vi.mocked(updateAspiration).mockReturnValueOnce(editing.promise)
    vi.mocked(moveAspiration).mockReturnValueOnce(moving.promise)
    const { result } = renderHook(() => {
      const aspiration = useAspiration('asp-fit', TODAY)
      const shown = useFleetingMessage(aspiration.message, { onGone: aspiration.clearMessage })
      return { aspiration, shown }
    })
    await waitFor(() => expect(result.current.aspiration.page).toBeDefined())
    vi.useFakeTimers()

    act(() => {
      result.current.aspiration.edit({ name: 'Be fit for life', why: '' })
      result.current.aspiration.move('down')
    })
    await act(async () => editing.reject(new Error('offline')))
    expect(result.current.shown.shown).toBe("Couldn't save that. Try again.")

    act(() => vi.advanceTimersByTime(6000))
    expect(result.current.shown.shown).toBeUndefined()

    await act(async () => moving.reject(new Error('offline')))
    expect(result.current.shown.shown).toBe("Couldn't save that. Try again.")
  })
})
