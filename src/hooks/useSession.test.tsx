import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signedOut, signIns } from '../api/session.ts'
import { addPasskey, redeemCode, signInWithPasskey, signOut } from '../api/signIn.ts'
import type { PasskeyOptions } from '../api/types.ts'
import { useSession } from './useSession.ts'

vi.mock('../api/signIn.ts', () => ({
  signInWithPasskey: vi.fn(),
  redeemCode: vi.fn(),
  addPasskey: vi.fn(),
  signOut: vi.fn(),
}))

const DIDNT_FINISH = "Sign-in didn't finish. Try again when you're ready."
const CODE_DIDNT_WORK =
  "That code didn't work. It may already have been used, or be more than ten minutes old. Ask for a new one."
const UNSUPPORTED = "This browser can't use a passkey."
const UNREACHABLE = "Couldn't reach the app. Try again in a moment."
const OPTIONS: PasskeyOptions = { challengeId: 'challenge-1', options: {} }

const onSignedIn = vi.fn()

beforeEach(() => {
  vi.mocked(signInWithPasskey).mockReset()
  vi.mocked(redeemCode).mockReset()
  vi.mocked(addPasskey).mockReset()
  vi.mocked(signOut).mockReset().mockResolvedValue(undefined)
  onSignedIn.mockReset()
})

function signedOutSession() {
  const hook = renderHook(() => useSession(onSignedIn))
  act(() => signedOut())
  return hook
}

describe('useSession', () => {
  it('starts signed in, on the first step, with nothing to say', () => {
    const { result } = renderHook(() => useSession(onSignedIn))

    expect(result.current.signedIn).toBe(true)
    expect(result.current.step).toBe('signIn')
    expect(result.current.message).toBeUndefined()
    expect(result.current.busy).toBe(false)
  })

  it('is signed out after a 401 anywhere', () => {
    const { result } = signedOutSession()

    expect(result.current.signedIn).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useSession(onSignedIn))
    unmount()

    signedOut()

    expect(result.current.signedIn).toBe(true)
  })

  it('signs in with a passkey and lets the app load again', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
    const { result } = signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.signedIn).toBe(true)
    expect(onSignedIn).toHaveBeenCalledTimes(1)
  })

  it.each(['cancelled', 'didntWork'] as const)('says sign-in didn’t finish when %s', async (outcome) => {
    vi.mocked(signInWithPasskey).mockResolvedValue(outcome)
    const { result } = signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.signedIn).toBe(false)
    expect(result.current.message).toBe(DIDNT_FINISH)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('says when the browser can’t use a passkey', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('unsupported')
    const { result } = signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.message).toBe(UNSUPPORTED)
  })

  it('says when the app can’t be reached', async () => {
    vi.mocked(signInWithPasskey).mockRejectedValue(new Error('POST /sign-in/start: 500'))
    const { result } = signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.message).toBe(UNREACHABLE)
    expect(result.current.busy).toBe(false)
  })

  it('is busy while a step is under way, and starts no second one', async () => {
    let finish: (outcome: 'signedIn') => void = () => {}
    vi.mocked(signInWithPasskey).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { result } = signedOutSession()

    act(() => void result.current.signIn())
    expect(result.current.busy).toBe(true)
    act(() => void result.current.signIn())
    expect(signInWithPasskey).toHaveBeenCalledTimes(1)

    await act(async () => finish('signedIn'))
    expect(result.current.busy).toBe(false)
  })

  it('counts each sign-in, so a 401 for a request sent before it is ignored', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
    const { result } = signedOutSession()
    const before = signIns()

    await act(() => result.current.signIn())

    expect(signIns()).toBe(before + 1)
  })

  describe('a one-time code', () => {
    it('opens the code step, and Back returns with the message cleared', async () => {
      vi.mocked(signInWithPasskey).mockResolvedValue('cancelled')
      const { result } = signedOutSession()
      await act(() => result.current.signIn())

      act(() => result.current.enterCode())
      expect(result.current.step).toBe('code')
      expect(result.current.message).toBeUndefined()

      act(() => result.current.back())
      expect(result.current.step).toBe('signIn')
    })

    it('isn’t sent when empty', async () => {
      const { result } = signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('   '))

      expect(redeemCode).not.toHaveBeenCalled()
      expect(result.current.step).toBe('code')
    })

    it('moves on to adding a passkey, which uses the redeemed options and signs in', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'redeemed', options: OPTIONS })
      vi.mocked(addPasskey).mockResolvedValue('signedIn')
      const { result } = signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('9F3K-ABCD'))
      expect(redeemCode).toHaveBeenCalledWith('9F3K-ABCD')
      expect(result.current.step).toBe('addPasskey')

      await act(() => result.current.addPasskey())
      expect(addPasskey).toHaveBeenCalledWith(OPTIONS)
      expect(result.current.signedIn).toBe(true)
      expect(result.current.step).toBe('signIn')
      expect(onSignedIn).toHaveBeenCalledTimes(1)
    })

    it('says when the code didn’t work, and stays on the code step', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'didntWork' })
      const { result } = signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('nope'))

      expect(result.current.step).toBe('code')
      expect(result.current.message).toBe(CODE_DIDNT_WORK)
    })

    it('goes back to the code step when the passkey is refused: the code is spent', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'redeemed', options: OPTIONS })
      vi.mocked(addPasskey).mockResolvedValue('didntWork')
      const { result } = signedOutSession()
      act(() => result.current.enterCode())
      await act(() => result.current.submitCode('9F3K'))

      await act(() => result.current.addPasskey())

      expect(result.current.step).toBe('code')
      expect(result.current.message).toBe(CODE_DIDNT_WORK)
      await act(() => result.current.addPasskey())
      expect(addPasskey).toHaveBeenCalledTimes(1)
    })

    it('ignores Back while a code is being checked', async () => {
      let finish: (redeemed: { outcome: 'redeemed'; options: PasskeyOptions }) => void = () => {}
      vi.mocked(redeemCode).mockReturnValue(new Promise((resolve) => (finish = resolve)))
      const { result } = signedOutSession()
      act(() => result.current.enterCode())

      act(() => void result.current.submitCode('9F3K'))
      act(() => result.current.back())
      expect(result.current.step).toBe('code')

      await act(async () => finish({ outcome: 'redeemed', options: OPTIONS }))
      expect(result.current.step).toBe('addPasskey')
    })

    it('says when adding the passkey didn’t finish, and stays to try again', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'redeemed', options: OPTIONS })
      vi.mocked(addPasskey).mockResolvedValue('cancelled')
      const { result } = signedOutSession()
      act(() => result.current.enterCode())
      await act(() => result.current.submitCode('9F3K'))

      await act(() => result.current.addPasskey())

      expect(result.current.step).toBe('addPasskey')
      expect(result.current.message).toBe(DIDNT_FINISH)
    })
  })

  describe('signing out', () => {
    it('ends the session and shows the first step', async () => {
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(signOut).toHaveBeenCalledTimes(1)
      expect(result.current.signedIn).toBe(false)
      expect(result.current.step).toBe('signIn')
    })

    it('is busy while signing out, and sends it once', async () => {
      let finish: () => void = () => {}
      vi.mocked(signOut).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
      const { result } = renderHook(() => useSession(onSignedIn))

      act(() => void result.current.signOut())
      expect(result.current.busy).toBe(true)
      act(() => void result.current.signOut())
      await act(async () => finish())

      expect(signOut).toHaveBeenCalledTimes(1)
      expect(result.current.busy).toBe(false)
      expect(result.current.signedIn).toBe(false)
    })

    it('is signed out even when the request fails: the cookie may be gone already', async () => {
      vi.mocked(signOut).mockRejectedValue(new Error('POST /sign-in/sign-out: 500'))
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(result.current.signedIn).toBe(false)
      expect(result.current.message).toBeUndefined()
    })
  })
})
