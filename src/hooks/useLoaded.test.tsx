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

  it('stores what the screen shows after a change, such as a save', async () => {
    const load = async () => ({ name: 'Be fit' })
    const { result } = renderHook(() => useLoaded('aspiration/a1', load, LOAD_FAILED))
    await waitFor(() => expect(result.current.data).toEqual({ name: 'Be fit' }))

    act(() => result.current.setData({ name: 'Be fit and strong' }))

    await waitFor(async () =>
      expect(await planStore().responses.get('aspiration/a1')).toEqual({ name: 'Be fit and strong' }),
    )
  })

  it("never stores one id's data under another id while the new one loads", async () => {
    const loads: Record<string, () => Promise<{ name: string }>> = {
      'goal/g1': async () => ({ name: 'Run a 10k' }),
      'goal/g2': () => new Promise(() => {}),
    }
    const { result, rerender } = renderHook(({ key }) => useLoaded(key, loads[key], LOAD_FAILED), {
      initialProps: { key: 'goal/g1' },
    })
    await waitFor(() => expect(result.current.data).toEqual({ name: 'Run a 10k' }))

    rerender({ key: 'goal/g2' })
    act(() => result.current.setData({ name: 'Run a half' }))
    await act(async () => {})

    expect(await planStore().responses.get('goal/g2')).toBeUndefined()
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

describe('useLoaded reload', () => {
  it('reads the record again and shows the fresh one', async () => {
    let name = 'Before'
    const load = async () => ({ name })
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))
    await waitFor(() => expect(result.current.data).toEqual({ name: 'Before' }))

    name = 'After'
    await act(async () => result.current.reload())

    expect(result.current.data).toEqual({ name: 'After' })
    await waitFor(async () => expect(await planStore().responses.get('goal/g1')).toEqual({ name: 'After' }))
  })

  it("keeps what's shown, and the save's message, when the reload fails", async () => {
    let fails = false
    const load = () => (fails ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ name: 'Shown' }))
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))
    await waitFor(() => expect(result.current.data).toEqual({ name: 'Shown' }))

    act(() => result.current.setMessage("Couldn't save that. Try again."))
    fails = true
    await act(async () => result.current.reload())

    expect(result.current.data).toEqual({ name: 'Shown' })
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })

  it('says the load failed when the reload fails with nothing else to say', async () => {
    let fails = false
    const load = () => (fails ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ name: 'Shown' }))
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))
    await waitFor(() => expect(result.current.data).toEqual({ name: 'Shown' }))

    fails = true
    await act(async () => result.current.reload())

    expect(result.current.message).toBe(LOAD_FAILED)
  })

  it('lets only the newest reload land', async () => {
    const answers = [deferred<{ name: string }>(), deferred<{ name: string }>()]
    let loads = 0
    const load = () => (loads++ === 0 ? Promise.resolve({ name: 'First' }) : answers[loads - 2].promise)
    const { result } = renderHook(() => useLoaded('goal/g1', load, LOAD_FAILED))
    await waitFor(() => expect(result.current.data).toEqual({ name: 'First' }))

    let older!: Promise<void>
    let newer!: Promise<void>
    act(() => {
      older = result.current.reload()
      newer = result.current.reload()
    })
    await act(async () => {
      answers[1].resolve({ name: 'Newer' })
      await newer
    })
    await act(async () => {
      answers[0].resolve({ name: 'Older' })
      await older
    })

    expect(result.current.data).toEqual({ name: 'Newer' })
  })
})
