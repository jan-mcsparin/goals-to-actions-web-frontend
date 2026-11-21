// Whether this device is signed in, and the sign-in page's steps: sign in
// with a passkey, or enter a one-time code and add a passkey (ADR-012). The
// app starts signed in; a 401 from any request (api/session.ts) says
// otherwise. With something stored, the session has ended over what's shown
// (a sheet, then after Not now a banner); with nothing, it's the sign-in page.
// A step that doesn't finish says so calmly, never as an error.
import { useCallback, useEffect, useRef, useState } from 'react'
import { onSignedOut, signedIn as countSignIn, signIns } from '../api/session.ts'
import { flush, waitingCount } from '../api/queue.ts'
import { anythingStored, clearStored } from '../api/stored.ts'
import * as passkeys from '../api/signIn.ts'
import type { SignInOutcome } from '../api/signIn.ts'
import type { PasskeyOptions } from '../api/types.ts'

const DIDNT_FINISH = "Sign-in didn't finish. Try again when you're ready."
const CODE_DIDNT_WORK =
  "That code didn't work. It may already have been used, or be more than ten minutes old. Ask for a new one."
const UNSUPPORTED = "This browser can't use a passkey."
const UNREACHABLE = "Couldn't reach the app. Try again in a moment."

export type SignInStep = 'signIn' | 'code' | 'addPasskey'

export type SessionStatus = 'signedIn' | 'sessionEnded' | 'signedOut'

export type UseSession = {
  status: SessionStatus
  // With the session ended: the sheet, rather than the banner.
  askingToSignIn: boolean
  step: SignInStep
  busy: boolean
  message?: string
  // Signing out found changes it couldn't send: the sheet warns with the count.
  unsent?: number
  signIn: () => Promise<void>
  notNow: () => void
  enterCode: () => void
  submitCode: (code: string) => Promise<void>
  addPasskey: () => Promise<void>
  back: () => void
  signOut: () => Promise<void>
  cancelSignOut: () => void
}

// `onSignedIn` runs after each sign-in: App loads the open screen again.
export function useSession(onSignedIn: () => void): UseSession {
  const [status, setStatus] = useState<SessionStatus>('signedIn')
  const [askingToSignIn, setAskingToSignIn] = useState(false)
  const [step, setStep] = useState<SignInStep>('signIn')
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [unsent, setUnsent] = useState<number>()
  const signingOut = useRef(false)
  const busyRef = useRef(false)
  const redeemed = useRef<PasskeyOptions>(undefined)
  // Not signed in, whichever way: a later 401 changes nothing.
  const ended = useRef(false)

  // Once ended, it stays so (and Not now stays) until a sign-in. A sign-in
  // while the store was being asked makes the answer stale.
  useEffect(
    () =>
      onSignedOut(() => {
        // Signing out says so itself, with the warning.
        if (signingOut.current) return
        const at = signIns()
        void anythingStored().then((stored) => {
          if (signIns() !== at || ended.current || signingOut.current) return
          ended.current = true
          setStatus(stored ? 'sessionEnded' : 'signedOut')
          setAskingToSignIn(stored)
        })
      }),
    [],
  )

  // One step at a time; a failed request is the one thing that throws.
  const run = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage(undefined)
    try {
      await work()
    } catch {
      setMessage(UNREACHABLE)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  function finished(outcome: SignInOutcome) {
    if (outcome === 'unsupported') {
      setMessage(UNSUPPORTED)
      return
    }
    if (outcome !== 'signedIn') {
      setMessage(DIDNT_FINISH)
      return
    }
    redeemed.current = undefined
    countSignIn()
    setStep('signIn')
    ended.current = false
    setStatus('signedIn')
    setAskingToSignIn(false)
    // App sends the queue, then loads the open screen again.
    onSignedIn()
  }

  // From the banner, the sheet opens with it: what didn't finish shows there.
  const signIn = () => {
    if (status === 'sessionEnded') setAskingToSignIn(true)
    return run(async () => finished(await passkeys.signInWithPasskey()))
  }

  function notNow() {
    setMessage(undefined)
    setAskingToSignIn(false)
  }

  function enterCode() {
    setMessage(undefined)
    setStep('code')
  }

  const submitCode = (code: string) =>
    code.trim() === ''
      ? Promise.resolve()
      : run(async () => {
          const result = await passkeys.redeemCode(code)
          if (result.outcome === 'didntWork') {
            setMessage(CODE_DIDNT_WORK)
          } else if (result.outcome === 'unsupported') {
            setMessage(UNSUPPORTED)
          } else {
            redeemed.current = result.options
            setStep('addPasskey')
          }
        })

  // The API takes the challenge with the first try, so a refused passkey has
  // spent the code: back to the code step for a new one. A closed sheet hasn't,
  // and can try again while the challenge lasts.
  const addPasskey = () =>
    run(async () => {
      if (!redeemed.current) return
      const outcome = await passkeys.addPasskey(redeemed.current)
      if (outcome !== 'didntWork') return finished(outcome)
      redeemed.current = undefined
      setStep('code')
      setMessage(CODE_DIDNT_WORK)
    })

  // Not while a step is under way, so its answer can't land on another step.
  function back() {
    if (busyRef.current) return
    setMessage(undefined)
    setStep('signIn')
  }

  // Sends what waits first. If some can't go, the sheet warns and nothing is
  // cleared until the person signs out anyway. Then everything stored is
  // cleared (ADR-012). Signed out either way: the cookie may be gone already.
  const signOut = () =>
    run(async () => {
      signingOut.current = true
      try {
        if (unsent === undefined) {
          await flush()
          const waiting = waitingCount()
          if (waiting > 0) {
            setUnsent(waiting)
            return
          }
        }
        try {
          await passkeys.signOut()
        } catch {
          // Nothing to tell: the session ends on its own in time.
        }
        await clearStored()
        ended.current = true
        setUnsent(undefined)
        setStep('signIn')
        setStatus('signedOut')
      } finally {
        signingOut.current = false
      }
    })

  // The sheet closed: next time, it sends again before warning.
  function cancelSignOut() {
    setUnsent(undefined)
  }

  return {
    status,
    askingToSignIn,
    step,
    busy,
    message,
    unsent,
    signIn,
    notNow,
    enterCode,
    submitCode,
    addPasskey,
    back,
    signOut,
    cancelSignOut,
  }
}
