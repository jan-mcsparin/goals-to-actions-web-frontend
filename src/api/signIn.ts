// Signing in with a passkey, adding one with a one-time code, and signing out
// (ADR-012). Passkeys go through the browser's own functions; the session is
// an HttpOnly cookie the page never sees. A step ends in an outcome, not an
// exception: cancelled (the person closed the passkey sheet), didntWork (the
// API said no, or the browser couldn't make one), or unsupported (the browser
// lacks the JSON functions). A failed request still throws.
//
// On mock data every step works without the browser, so the click-through
// can sign out and back in.
import { SignedOutError } from './errors.ts'
import { realApi } from './mode.ts'
import { request } from './request.ts'
import type { PasskeyOptions } from './types.ts'

export type SignInOutcome = 'signedIn' | 'cancelled' | 'didntWork' | 'unsupported'

export type Redeemed =
  | { outcome: 'redeemed'; options: PasskeyOptions }
  | { outcome: 'didntWork' }
  | { outcome: 'unsupported' }

const MOCK_OPTIONS: PasskeyOptions = { challengeId: '00000000-0000-4000-8000-000000000000', options: {} }

export async function signInWithPasskey(): Promise<SignInOutcome> {
  if (!realApi) return 'signedIn'
  if (!passkeysSupported()) return 'unsupported'
  const { challengeId, options } = await request<PasskeyOptions>('POST', '/sign-in/start')
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
    options as unknown as PublicKeyCredentialRequestOptionsJSON,
  )
  return finish('/sign-in/finish', challengeId, () => navigator.credentials.get({ publicKey }))
}

// Checks support first, so a code isn't spent on a browser that can't use it.
export async function redeemCode(code: string): Promise<Redeemed> {
  if (!realApi) return { outcome: 'redeemed', options: MOCK_OPTIONS }
  if (!passkeysSupported()) return { outcome: 'unsupported' }
  try {
    const options = await request<PasskeyOptions>('POST', '/sign-in/code', { code: code.trim() })
    return { outcome: 'redeemed', options }
  } catch (error) {
    if (error instanceof SignedOutError) return { outcome: 'didntWork' }
    throw error
  }
}

export async function addPasskey({ challengeId, options }: PasskeyOptions): Promise<SignInOutcome> {
  if (!realApi) return 'signedIn'
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
    options as unknown as PublicKeyCredentialCreationOptionsJSON,
  )
  return finish('/sign-in/passkeys', challengeId, () => navigator.credentials.create({ publicKey }))
}

export async function signOut(): Promise<void> {
  if (!realApi) return
  await request<void>('POST', '/sign-in/sign-out')
}

function passkeysSupported(): boolean {
  return (
    typeof PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
    typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function'
  )
}

// Asks the browser for the passkey, then sends it back with its challenge.
async function finish(
  path: string,
  challengeId: string,
  askBrowser: () => Promise<Credential | null>,
): Promise<SignInOutcome> {
  let credential: Credential | null
  try {
    credential = await askBrowser()
  } catch (error) {
    return closedByPerson(error) ? 'cancelled' : 'didntWork'
  }
  if (!credential) return 'cancelled'
  try {
    await request<void>('POST', path, { challengeId, credential: (credential as PublicKeyCredential).toJSON() })
    return 'signedIn'
  } catch (error) {
    if (error instanceof SignedOutError) return 'didntWork'
    throw error
  }
}

// NotAllowedError is also what a timed-out sheet gives: either way, the
// person didn't finish, and nothing went wrong.
function closedByPerson(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')
}
