import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotFoundError, SignedOutError } from '../api/errors.ts'
import { planStore } from '../storage/planStore.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load that."

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useLoaded', () => {
  it('reports a failed load', async () => {
    const load = () => Promise.reject(new Error('GET /x: 500'))
    const { result } = renderHook(() => useLoaded('x', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
    expect(result.current.data).toBeUndefined()
  })

  it('says nothing when signed out: the sign-in page is the message', async () => {
    let failed = false
    const load = () => {
      failed = true
      return Promise.reject(new SignedOutError('GET /x: 401'))
    }
    const { result } = renderHook(() => useLoaded('x', load, LOAD_FAILED))

    await waitFor(() => expect(failed).toBe(true))
    await Promise.resolve()
    expect(result.current.message).toBeUndefined()
    expect(result.current.notFound).toBe(false)
  })

  it('shows the stored response before the load lands, then the fresh one, and stores it', async () => {
    await planStore().responses.put('goal/g1', { name: 'As it was' })
    const answer = deferred<{ name: string }>()

    const load = () => answer.promise
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.data).toEqual({ name: 'As it was' }))
    await act(async () => answer.resolve({ name: 'As it is' }))
    expect(result.current.data).toEqual({ name: 'As it is' })
    await waitFor(async () => expect(await planStore().responses.get('goal/g1')).toEqual({ name: 'As it is' }))
  })

  it("never shows the stored response over a fresh one that landed first", async () => {
    const stored = deferred<unknown>()
    vi.spyOn(planStore().responses, 'get').mockReturnValueOnce(stored.promise as never)

    const load = async () => ({ name: 'Fresh' })
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.data).toEqual({ name: 'Fresh' }))
    await act(async () => stored.resolve({ name: 'Stale' }))
    expect(result.current.data).toEqual({ name: 'Fresh' })
  })

  it('keeps the stored response on a failed load, and says so', async () => {
    await planStore().responses.put('aspirations', { count: 3 })

    const load = () => Promise.reject(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useLoaded('aspirations', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
    expect(result.current.data).toEqual({ count: 3 })
  })

  it('shows the stored response even when the load fails before it is read, as offline', async () => {
    const stored = deferred<unknown>()
    vi.spyOn(planStore().responses, 'get').mockReturnValueOnce(stored.promise as never)
    const load = () => Promise.reject(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useLoaded('aspirations', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
    await act(async () => stored.resolve({ count: 3 }))
    expect(result.current.data).toEqual({ count: 3 })
  })

  it("doesn't show another id's stored response", async () => {
    await planStore().responses.put('goal/g1', { name: 'Run a 10k' })

    const load = () => Promise.reject(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useLoaded('goal/g2', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
    expect(result.current.data).toBeUndefined()
  })

  it('forgets the stored response of a record that is gone, and never shows it', async () => {
    await planStore().responses.put('goal/g1', { name: 'Run a 10k' })
    const stored = deferred<unknown>()
    vi.spyOn(planStore().responses, 'get').mockReturnValueOnce(stored.promise as never)

    const load = () => Promise.reject(new NotFoundError('GET /goals/g1: 404'))
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.notFound).toBe(true))
    await waitFor(async () => expect(await planStore().responses.get('goal/g1')).toBeUndefined())
    await act(async () => stored.resolve({ name: 'Run a 10k' }))
    expect(result.current.data).toBeUndefined()
  })

  it('works as before when storage fails', async () => {
    const { responses } = planStore()
    vi.spyOn(responses, 'get').mockRejectedValue(new Error('no storage'))
    vi.spyOn(responses, 'put').mockRejectedValue(new Error('no storage'))

    const load = async () => ({ intensity: 'steady' })
    const { result } = renderHook(() => useLoaded('settings', load, LOAD_FAILED))

    await waitFor(() => expect(result.current.data).toEqual({ intensity: 'steady' }))
    expect(result.current.message).toBeUndefined()
  })
})
