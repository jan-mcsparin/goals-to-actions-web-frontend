import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSettings, setIntensity } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { Settings } from '../api/types.ts'
import { useSettings } from './useSettings.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getSettings: vi.fn(actual.getSettings), setIntensity: vi.fn(actual.setIntensity) }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getSettings).mockClear()
  vi.mocked(setIntensity).mockClear()
})

async function loaded() {
  const hook = renderHook(() => useSettings())
  await waitFor(() => expect(hook.result.current.intensity).toBeDefined())
  return hook
}

describe('useSettings', () => {
  it('loads the saved intensity', async () => {
    const { result } = await loaded()

    expect(result.current.intensity).toBe('normal')
    expect(result.current.message).toBeUndefined()
  })

  it('shows a new intensity at once and saves it', async () => {
    const { result } = await loaded()

    act(() => result.current.chooseIntensity('goingHard'))

    expect(result.current.intensity).toBe('goingHard')
    expect(setIntensity).toHaveBeenCalledWith('goingHard')
    expect(await getSettings()).toMatchObject({ intensity: 'goingHard' })
  })

  it('goes back to the earlier intensity, with a message, when the save fails', async () => {
    vi.mocked(setIntensity).mockRejectedValueOnce(new Error('offline'))
    const { result } = await loaded()

    act(() => result.current.chooseIntensity('easingOff'))

    await waitFor(() => expect(result.current.message).toBe("Couldn't save that. Try again."))
    expect(result.current.intensity).toBe('normal')
  })

  it('keeps the newest choice when an earlier save fails after it', async () => {
    let failFirst: (reason: Error) => void = () => {}
    vi.mocked(setIntensity).mockImplementationOnce(
      () => new Promise<Settings>((_resolve, reject) => (failFirst = reject)),
    )
    const { result } = await loaded()

    act(() => result.current.chooseIntensity('easingOff'))
    act(() => result.current.chooseIntensity('goingHard'))
    await act(async () => failFirst(new Error('offline')))

    expect(result.current.intensity).toBe('goingHard')
    expect(result.current.message).toBeUndefined()
  })

  it('says export is coming later', async () => {
    const { result } = await loaded()

    act(() => result.current.exportData())

    await waitFor(() => expect(result.current.message).toBe('Coming later.'))
  })

  it('says so when settings fail to load', async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.message).toBe("Couldn't load settings. Try again in a moment."))
    expect(result.current.intensity).toBeUndefined()
  })

  it('leaves a load failure in place if export is asked for anyway', async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.message).toBeDefined())

    await act(async () => result.current.exportData())

    expect(result.current.message).toBe("Couldn't load settings. Try again in a moment.")
  })
})
