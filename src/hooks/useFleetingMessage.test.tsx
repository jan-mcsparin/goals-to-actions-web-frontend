import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFleetingMessage } from './useFleetingMessage.ts'

const SAVE_FAILED = "Couldn't save that. Try again."
const LOAD_FAILED = "Couldn't load today. Try again in a moment."

function renderMessage(message?: string, sticky = false) {
  return renderHook(({ message, sticky }) => useFleetingMessage(message, { sticky }), {
    initialProps: { message, sticky },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFleetingMessage', () => {
  it('shows nothing without a message', () => {
    const { result } = renderMessage()
    expect(result.current.shown).toBeUndefined()
  })

  it('shows a message at once and clears it after 5 seconds', () => {
    const { result, rerender } = renderMessage()
    rerender({ message: SAVE_FAILED, sticky: false })
    expect(result.current.shown).toBe(SAVE_FAILED)

    act(() => vi.advanceTimersByTime(4999))
    expect(result.current.shown).toBe(SAVE_FAILED)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.shown).toBeUndefined()
  })

  it('clears a message at once when dismissed', () => {
    const { result } = renderMessage(SAVE_FAILED)
    act(() => result.current.dismiss())
    expect(result.current.shown).toBeUndefined()
  })

  it('restarts the timer for a new message', () => {
    const { result, rerender } = renderMessage(LOAD_FAILED)
    act(() => vi.advanceTimersByTime(4000))
    rerender({ message: SAVE_FAILED, sticky: false })

    act(() => vi.advanceTimersByTime(4999))
    expect(result.current.shown).toBe(SAVE_FAILED)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.shown).toBeUndefined()
  })

  it('shows the same message again after it was cleared', () => {
    const { result, rerender } = renderMessage(SAVE_FAILED)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.shown).toBeUndefined()

    // Screen hooks clear their message when a save starts, then set it again if it fails.
    rerender({ message: undefined, sticky: false })
    rerender({ message: SAVE_FAILED, sticky: false })
    expect(result.current.shown).toBe(SAVE_FAILED)
  })

  it('keeps a sticky message until it is dismissed', () => {
    const { result } = renderMessage(LOAD_FAILED, true)
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current.shown).toBe(LOAD_FAILED)

    act(() => result.current.dismiss())
    expect(result.current.shown).toBeUndefined()
  })

  it('clears when the screen clears its message', () => {
    const { result, rerender } = renderMessage(SAVE_FAILED)
    rerender({ message: undefined, sticky: false })
    expect(result.current.shown).toBeUndefined()
  })
})
