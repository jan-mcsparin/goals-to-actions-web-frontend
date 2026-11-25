import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SAVE_FAILED, useSavesOnTheirWay } from './useSavesOnTheirWay.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderSaves(reload: () => Promise<void>) {
  return renderHook(() => {
    const [message, setMessage] = useState<string>()
    return { message, track: useSavesOnTheirWay(reload, setMessage) }
  })
}

describe('useSavesOnTheirWay', () => {
  it('says nothing and reads nothing again when saves work', async () => {
    const reload = vi.fn(async () => {})
    const { result } = renderSaves(reload)

    await act(async () => result.current.track(Promise.resolve()))

    expect(result.current.message).toBeUndefined()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reads the record again once, after the last save on its way, when one failed', async () => {
    const reload = vi.fn(async () => {})
    const first = deferred<void>()
    const second = deferred<void>()
    const { result } = renderSaves(reload)

    act(() => {
      result.current.track(first.promise)
      result.current.track(second.promise)
    })
    await act(async () => first.reject(new Error('offline')))
    expect(result.current.message).toBe(SAVE_FAILED)
    expect(reload).not.toHaveBeenCalled()

    await act(async () => second.resolve())
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reads again when a save started while the last read was on its way', async () => {
    const reading = deferred<void>()
    const reload = vi.fn().mockReturnValueOnce(reading.promise).mockResolvedValue(undefined)
    const { result } = renderSaves(reload)

    await act(async () => result.current.track(Promise.reject(new Error('offline'))))
    expect(reload).toHaveBeenCalledOnce()

    const later = deferred<void>()
    act(() => result.current.track(later.promise))
    await act(async () => later.resolve())
    await act(async () => reading.resolve())

    expect(reload).toHaveBeenCalledTimes(2)
  })
})
