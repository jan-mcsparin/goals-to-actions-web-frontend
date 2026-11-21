// The sign-in page, shown in place of the app while this device is signed
// out (ADR-012): sign in with a passkey, or a one-time code to add one on a
// new device. useSession decides; this only draws its step. Nothing here
// reads as an error: a step that didn't finish says so calmly.
import { useState, type FormEvent } from 'react'
import { BackLink } from '../components/BackLink.tsx'
import { FaceIdIcon } from '../components/FaceIdIcon.tsx'
import { LogoMark } from '../components/LogoMark.tsx'
import { APP_NAME } from '../config.ts'
import type { UseSession } from '../hooks/useSession.ts'
import '../components/signInButtons.css'
import './SignIn.css'

type SignInProps = {
  session: UseSession
}

export function SignIn({ session }: SignInProps) {
  return (
    <main className="sign-in" aria-busy={session.busy}>
      {session.step === 'signIn' && <SignInStep session={session} />}
      {session.step === 'code' && <CodeStep session={session} />}
      {session.step === 'addPasskey' && <AddPasskeyStep session={session} />}
    </main>
  )
}

function SignInStep({ session }: SignInProps) {
  return (
    <>
      <div className="sign-in-welcome">
        <LogoMark size={104} />
        <h1 className="sign-in-name">
          <Name />
        </h1>
        <p className="sign-in-line">Small steps today toward who you want to be.</p>
      </div>
      <div className="sign-in-actions">
        <p className="sign-in-status" role="status">
          {session.message}
        </p>
        <button type="button" className="sign-in-primary" disabled={session.busy} onClick={session.signIn}>
          <FaceIdIcon />
          Sign in with Face ID
        </button>
        <button type="button" className="sign-in-secondary" disabled={session.busy} onClick={session.enterCode}>
          New device? Use a one-time code
        </button>
        <p className="sign-in-small">No password. Your passkey stays on your devices.</p>
      </div>
    </>
  )
}

function CodeStep({ session }: SignInProps) {
  const [code, setCode] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void session.submitCode(code)
  }

  return (
    <form className="sign-in-step" onSubmit={submit}>
      <div className="sign-in-top">
        <BackLink onBack={session.back} disabled={session.busy} />
        <LogoMark size={36} />
        <h1 className="sign-in-title">Enter your one-time code</h1>
        <p className="sign-in-text">You get a code to set up a new device. It works once, within ten minutes.</p>
        <label className="sign-in-label" htmlFor="sign-in-code">
          One-time code
        </label>
        <input
          id="sign-in-code"
          className="sign-in-field"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={session.message !== undefined}
          aria-describedby={session.message ? 'sign-in-code-message' : undefined}
        />
        {session.message && (
          <p id="sign-in-code-message" className="sign-in-field-message">
            {session.message}
          </p>
        )}
      </div>
      <div className="sign-in-actions">
        <button type="submit" className="sign-in-primary" disabled={session.busy || code.trim() === ''}>
          Continue
        </button>
      </div>
    </form>
  )
}

function AddPasskeyStep({ session }: SignInProps) {
  return (
    <div className="sign-in-step">
      <div className="sign-in-top">
        <p className="sign-in-accepted">
          <span aria-hidden="true">✓ </span>
          Code accepted
        </p>
        <h1 className="sign-in-title">Add a passkey to this device</h1>
        <p className="sign-in-text">
          From now on you'll sign in with Face ID. There's nothing to remember, and nothing that can be phished.
        </p>
        <p className="sign-in-text">If iCloud Keychain is on, your Mac can use the same passkey.</p>
      </div>
      <div className="sign-in-actions">
        <p className="sign-in-status" role="status">
          {session.message}
        </p>
        <button type="button" className="sign-in-primary" disabled={session.busy} onClick={session.addPasskey}>
          <FaceIdIcon />
          Add passkey
        </button>
      </div>
    </div>
  )
}

// The wordmark: "to" in muted ink, as in ../docs/brand/wordmark.svg.
function Name() {
  const [before, after] = APP_NAME.split(' to ')
  if (after === undefined) return APP_NAME
  return (
    <>
      {before} <span className="sign-in-name-to">to</span> {after}
    </>
  )
}
