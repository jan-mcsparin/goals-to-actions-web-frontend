import { useId } from 'react'
import { unsentLine } from '../domain/session.ts'
import './editForm.css'
import './SignOutSheet.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type SignOutSheetProps = {
  open: boolean
  // Held while signing out, so it's sent once.
  busy?: boolean
  // Changes that couldn't be sent: warned of before signing out anyway.
  unsent?: number
  onSignOut: () => void
  onClose: () => void
}

// Asks once before signing out, saying what goes and what stays. When signing
// out couldn't send every change, it says how many would be lost first.
export function SignOutSheet({ open, busy, unsent, onSignOut, onClose }: SignOutSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Sign out of this device?</h2>
      </header>
      <p className="sheet-note">
        This clears what's stored on this device. Your aspirations, goals and history stay safe on the server; sign in
        with your passkey to get them back.
      </p>
      {unsent !== undefined && unsent > 0 && (
        <p className="sheet-note sign-out-warning" role="status">
          <strong>{unsentLine(unsent)}</strong> Signing out deletes them from this phone.
        </p>
      )}
      <div className="edit-form-actions sheet-actions">
        <button type="button" className="edit-form-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="edit-form-save" disabled={busy} onClick={onSignOut}>
          {unsent ? 'Sign out anyway' : 'Sign out'}
        </button>
      </div>
    </dialog>
  )
}
