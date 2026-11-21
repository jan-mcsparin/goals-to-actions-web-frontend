import { useId } from 'react'
import { safeLine } from '../domain/session.ts'
import { FaceIdIcon } from './FaceIdIcon.tsx'
import { LogoMark } from './LogoMark.tsx'
import './SessionEndedSheet.css'
import './sheet.css'
import './signInButtons.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type SessionEndedSheetProps = {
  open: boolean
  // Changes on the phone not yet sent.
  waiting: number
  busy?: boolean
  // What didn't finish, said calmly (useSession).
  message?: string
  onSignIn: () => void
  onNotNow: () => void
}

// The session ended over what the phone has stored (ADR-012, sketch panel 4):
// never an error, and the screen stays. Not now, Escape or the backdrop close it.
export function SessionEndedSheet({ open, waiting, busy, message, onSignIn, onNotNow }: SessionEndedSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onNotNow)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet session-ended" aria-labelledby={titleId} onClose={onNotNow} {...backdropClose}>
      <LogoMark size={32} />
      <header className="sheet-header">
        <h2 id={titleId}>Sign in to keep saving</h2>
      </header>
      <p className="sheet-note">{safeLine(waiting)}</p>
      <p className="session-ended-status" role="status">
        {message}
      </p>
      <div className="session-ended-actions">
        <button type="button" className="sign-in-primary" disabled={busy} onClick={onSignIn}>
          <FaceIdIcon />
          Sign in with Face ID
        </button>
        <button type="button" className="sign-in-secondary" onClick={onNotNow}>
          Not now
        </button>
      </div>
    </dialog>
  )
}
