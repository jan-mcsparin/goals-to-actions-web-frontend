import { describe, expect, it, vi } from 'vitest'
import { onSignedOut, signedIn, signedOut, signIns } from './session.ts'

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

  it('ignores a 401 for a request sent before the latest sign-in', () => {
    const listener = vi.fn()
    const stop = onSignedOut(listener)
    const sentAt = signIns()

    signedIn()
    signedOut(sentAt)
    expect(listener).not.toHaveBeenCalled()

    signedOut(signIns())
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })
})
