import { describe, expect, it, vi } from 'vitest'
import { onSignedOut, signedOut } from './session.ts'

describe('session', () => {
  it('tells every listener it has signed out', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = onSignedOut(first)
    const stopSecond = onSignedOut(second)

    signedOut()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    stopFirst()
    stopSecond()
  })

  it('stops telling a listener that has stopped listening', () => {
    const listener = vi.fn()
    const stop = onSignedOut(listener)

    stop()
    signedOut()

    expect(listener).not.toHaveBeenCalled()
  })
})
