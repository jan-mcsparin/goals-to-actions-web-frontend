import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask } from '../api/client.ts'
import { SignedOutError } from '../api/errors.ts'
import { enqueue, resetQueue, waitingCount } from '../api/queue.ts'
import { signedOut, signIns } from '../api/session.ts'
import type { Change } from '../domain/replay.ts'
import { planStore, resetPlanStore } from '../storage/planStore.ts'
import { addPasskey, redeemCode, signInWithPasskey, signOut } from '../api/signIn.ts'
import type { PasskeyOptions } from '../api/types.ts'
import { useSession } from './useSession.ts'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  checkOffTask: vi.fn(),
}))

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

const CHANGE: Change = {
  kind: 'checkOff',
  id: 'c1',
  taskId: 't1',
  checkOff: { completedAt: '2026-11-20T16:00:00.000Z', completedOn: '2026-11-20', valueLogged: null },
}

beforeEach(() => {
  resetPlanStore()
  resetQueue()
  vi.mocked(checkOffTask).mockReset().mockRejectedValue(new SignedOutError('not signed in'))
  vi.mocked(signInWithPasskey).mockReset()
  vi.mocked(redeemCode).mockReset()
  vi.mocked(addPasskey).mockReset()
  vi.mocked(signOut).mockReset().mockResolvedValue(undefined)
  onSignedIn.mockReset()
})

// A 401 lands; with nothing stored, that's the sign-in page.
async function signedOutSession() {
  const hook = renderHook(() => useSession(onSignedIn))
  await act(async () => signedOut())
  return hook
}

// A 401 lands with something stored: the session ended over what's shown.
async function endedSession() {
  await planStore().responses.put('settings', {})
  return signedOutSession()
}

describe('useSession', () => {
  it('starts signed in, on the first step, with nothing to say', () => {
    const { result } = renderHook(() => useSession(onSignedIn))

    expect(result.current.status).toBe('signedIn')
    expect(result.current.step).toBe('signIn')
    expect(result.current.message).toBeUndefined()
    expect(result.current.busy).toBe(false)
  })

  it('is signed out after a 401 with nothing stored: the sign-in page', async () => {
    const { result } = await signedOutSession()

    expect(result.current.status).toBe('signedOut')
  })

  describe('a session that ends with something stored', () => {
    it.each([
      ['a week', () => planStore().weeks.put('2026-11-16', {} as never)],
      ['a last response', () => planStore().responses.put('settings', {})],
      ['a change waiting', () => enqueue(CHANGE)],
    ])('has ended, not signed out, with %s', async (_, keep) => {
      await keep()
      const { result } = await signedOutSession()

      expect(result.current.status).toBe('sessionEnded')
      expect(result.current.askingToSignIn).toBe(true)
    })

    it('leaves the banner after Not now, and later 401s keep it that way', async () => {
      const { result } = await endedSession()

      act(() => result.current.notNow())
      expect(result.current.askingToSignIn).toBe(false)
      await act(async () => signedOut())

      expect(result.current.status).toBe('sessionEnded')
      expect(result.current.askingToSignIn).toBe(false)
    })

    it('signs in from the banner and lets the app send and load again', async () => {
      vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
      const { result } = await endedSession()
      act(() => result.current.notNow())

      await act(() => result.current.signIn())

      expect(result.current.status).toBe('signedIn')
      expect(result.current.askingToSignIn).toBe(false)
      expect(onSignedIn).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet again when signing in from the banner doesn’t finish, to say so', async () => {
      vi.mocked(signInWithPasskey).mockResolvedValue('cancelled')
      const { result } = await endedSession()
      act(() => result.current.notNow())

      await act(() => result.current.signIn())

      expect(result.current.status).toBe('sessionEnded')
      expect(result.current.askingToSignIn).toBe(true)
      expect(result.current.message).toBe(DIDNT_FINISH)
    })

    it('ignores a 401 whose answer lands after a sign-in', async () => {
      let answer: () => void = () => {}
      const slow = new Promise<void>((resolve) => (answer = resolve))
      vi.spyOn(planStore().weeks, 'entries').mockReturnValueOnce(slow.then(() => []))
      vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
      const { result } = renderHook(() => useSession(onSignedIn))

      act(() => signedOut())
      await act(() => result.current.signIn())
      await act(async () => answer())

      expect(result.current.status).toBe('signedIn')
    })
  })

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useSession(onSignedIn))
    unmount()

    signedOut()

    expect(result.current.status).toBe('signedIn')
  })

  it('signs in with a passkey and lets the app load again', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
    const { result } = await signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.status).toBe('signedIn')
    expect(onSignedIn).toHaveBeenCalledTimes(1)
  })

  it.each(['cancelled', 'didntWork'] as const)('says sign-in didn’t finish when %s', async (outcome) => {
    vi.mocked(signInWithPasskey).mockResolvedValue(outcome)
    const { result } = await signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.status).toBe('signedOut')
    expect(result.current.message).toBe(DIDNT_FINISH)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('says when the browser can’t use a passkey', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('unsupported')
    const { result } = await signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.message).toBe(UNSUPPORTED)
  })

  it('says when the app can’t be reached', async () => {
    vi.mocked(signInWithPasskey).mockRejectedValue(new Error('POST /sign-in/start: 500'))
    const { result } = await signedOutSession()

    await act(() => result.current.signIn())

    expect(result.current.message).toBe(UNREACHABLE)
    expect(result.current.busy).toBe(false)
  })

  it('is busy while a step is under way, and starts no second one', async () => {
    let finish: (outcome: 'signedIn') => void = () => {}
    vi.mocked(signInWithPasskey).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { result } = await signedOutSession()

    act(() => void result.current.signIn())
    expect(result.current.busy).toBe(true)
    act(() => void result.current.signIn())
    expect(signInWithPasskey).toHaveBeenCalledTimes(1)

    await act(async () => finish('signedIn'))
    expect(result.current.busy).toBe(false)
  })

  it('counts each sign-in, so a 401 for a request sent before it is ignored', async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue('signedIn')
    const { result } = await signedOutSession()
    const before = signIns()

    await act(() => result.current.signIn())

    expect(signIns()).toBe(before + 1)
  })

  describe('a one-time code', () => {
    it('opens the code step, and Back returns with the message cleared', async () => {
      vi.mocked(signInWithPasskey).mockResolvedValue('cancelled')
      const { result } = await signedOutSession()
      await act(() => result.current.signIn())

      act(() => result.current.enterCode())
      expect(result.current.step).toBe('code')
      expect(result.current.message).toBeUndefined()

      act(() => result.current.back())
      expect(result.current.step).toBe('signIn')
    })

    it('isn’t sent when empty', async () => {
      const { result } = await signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('   '))

      expect(redeemCode).not.toHaveBeenCalled()
      expect(result.current.step).toBe('code')
    })

    it('moves on to adding a passkey, which uses the redeemed options and signs in', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'redeemed', options: OPTIONS })
      vi.mocked(addPasskey).mockResolvedValue('signedIn')
      const { result } = await signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('9F3K-ABCD'))
      expect(redeemCode).toHaveBeenCalledWith('9F3K-ABCD')
      expect(result.current.step).toBe('addPasskey')

      await act(() => result.current.addPasskey())
      expect(addPasskey).toHaveBeenCalledWith(OPTIONS)
      expect(result.current.status).toBe('signedIn')
      expect(result.current.step).toBe('signIn')
      expect(onSignedIn).toHaveBeenCalledTimes(1)
    })

    it('says when the code didn’t work, and stays on the code step', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'didntWork' })
      const { result } = await signedOutSession()
      act(() => result.current.enterCode())

      await act(() => result.current.submitCode('nope'))

      expect(result.current.step).toBe('code')
      expect(result.current.message).toBe(CODE_DIDNT_WORK)
    })

    it('goes back to the code step when the passkey is refused: the code is spent', async () => {
      vi.mocked(redeemCode).mockResolvedValue({ outcome: 'redeemed', options: OPTIONS })
      vi.mocked(addPasskey).mockResolvedValue('didntWork')
      const { result } = await signedOutSession()
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
      const { result } = await signedOutSession()
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
      const { result } = await signedOutSession()
      act(() => result.current.enterCode())
      await act(() => result.current.submitCode('9F3K'))

      await act(() => result.current.addPasskey())

      expect(result.current.step).toBe('addPasskey')
      expect(result.current.message).toBe(DIDNT_FINISH)
    })
  })

  describe('signing out', () => {
    it('sends what waits first, then clears every store and the queue', async () => {
      vi.mocked(checkOffTask).mockResolvedValue({} as never)
      await planStore().weeks.put('2026-11-16', {} as never)
      await planStore().responses.put('goal/g1', {})
      await enqueue(CHANGE)
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(checkOffTask).toHaveBeenCalledWith('t1', expect.anything())
      expect(result.current.status).toBe('signedOut')
      expect(await planStore().weeks.entries()).toEqual([])
      expect(await planStore().responses.entries()).toEqual([])
      expect(await planStore().queue.entries()).toEqual([])
      expect(waitingCount()).toBe(0)
    })

    it('warns when changes can’t be sent, and clears nothing until signed out anyway', async () => {
      vi.mocked(checkOffTask).mockRejectedValue(new Error('Failed to fetch'))
      await enqueue(CHANGE)
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(result.current.unsent).toBe(1)
      expect(result.current.status).toBe('signedIn')
      expect(signOut).not.toHaveBeenCalled()
      expect(await planStore().queue.entries()).toHaveLength(1)

      await act(() => result.current.signOut())

      expect(signOut).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('signedOut')
      expect(result.current.unsent).toBeUndefined()
      expect(await planStore().queue.entries()).toEqual([])
      expect(waitingCount()).toBe(0)
    })

    it('forgets the warning when the sheet is closed, and sends again next time', async () => {
      vi.mocked(checkOffTask).mockRejectedValue(new Error('Failed to fetch'))
      await enqueue(CHANGE)
      const { result } = renderHook(() => useSession(onSignedIn))
      await act(() => result.current.signOut())

      act(() => result.current.cancelSignOut())
      expect(result.current.unsent).toBeUndefined()
      vi.mocked(checkOffTask).mockClear().mockResolvedValue({} as never)
      await act(() => result.current.signOut())

      expect(checkOffTask).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('signedOut')
    })

    it('doesn’t open the session-ended sheet for a 401 while sending', async () => {
      vi.mocked(checkOffTask).mockImplementation(async () => {
        signedOut()
        throw new SignedOutError('not signed in')
      })
      await enqueue(CHANGE)
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(result.current.status).toBe('signedIn')
      expect(result.current.askingToSignIn).toBe(false)
      expect(result.current.unsent).toBe(1)
    })

    it('ends the session and shows the first step', async () => {
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(signOut).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('signedOut')
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
      expect(result.current.status).toBe('signedOut')
    })

    it('is signed out even when the request fails: the cookie may be gone already', async () => {
      vi.mocked(signOut).mockRejectedValue(new Error('POST /sign-in/sign-out: 500'))
      const { result } = renderHook(() => useSession(onSignedIn))

      await act(() => result.current.signOut())

      expect(result.current.status).toBe('signedOut')
      expect(result.current.message).toBeUndefined()
    })
  })
})
