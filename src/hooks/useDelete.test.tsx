import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../api/errors.ts'
import { DELETE_FAILED } from '../domain/deleting.ts'
import { useDelete } from './useDelete.ts'

function setUp(send = vi.fn(async (_id: string) => {})) {
  const done = vi.fn(async (_id: string) => {})
  const failed = vi.fn((_message: string) => {})
  const rendered = renderHook(() => useDelete({ send, done, failed }))
  return { ...rendered, send, done, failed }
}

describe('useDelete', () => {
  it('asks before sending anything', () => {
    const { result, send } = setUp()

    act(() => result.current.ask('t1'))

    expect(result.current.asking).toBe('t1')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends once on confirm, closes and calls done', async () => {
    const { result, send, done, failed } = setUp()
    act(() => result.current.ask('t1'))

    await act(() => result.current.confirm())

    expect(send).toHaveBeenCalledExactlyOnceWith('t1')
    expect(done).toHaveBeenCalledWith('t1')
    expect(failed).not.toHaveBeenCalled()
    expect(result.current.asking).toBeUndefined()
  })

  it('sends nothing on cancel', async () => {
    const { result, send } = setUp()
    act(() => result.current.ask('t1'))

    act(() => result.current.cancel())
    await act(() => result.current.confirm())

    expect(result.current.asking).toBeUndefined()
    expect(send).not.toHaveBeenCalled()
  })

  it('counts a 404 as done: deleted on another device', async () => {
    const { result, done, failed } = setUp(
      vi.fn(async () => {
        throw new NotFoundError('gone')
      }),
    )
    act(() => result.current.ask('t1'))

    await act(() => result.current.confirm())

    expect(done).toHaveBeenCalledWith('t1')
    expect(failed).not.toHaveBeenCalled()
  })

  it('on any other failure, says so and changes nothing', async () => {
    const { result, done, failed } = setUp(
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    act(() => result.current.ask('t1'))

    await act(() => result.current.confirm())

    expect(failed).toHaveBeenCalledWith(DELETE_FAILED)
    expect(done).not.toHaveBeenCalled()
    expect(result.current.asking).toBeUndefined()
  })

  it('does nothing on a second confirm while one is on its way', async () => {
    let finish = () => {}
    const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const { result } = setUp(send)
    act(() => result.current.ask('t1'))

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.confirm()
    })
    act(() => result.current.ask('t1'))
    await act(() => result.current.confirm())
    finish()
    await act(() => first)

    expect(send).toHaveBeenCalledTimes(1)
  })
})
