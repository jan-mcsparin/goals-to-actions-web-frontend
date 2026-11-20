import { useId } from 'react'
import './editForm.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type SignOutSheetProps = {
  open: boolean
  onSignOut: () => void
  onClose: () => void
}

// Asks once before signing out, saying what goes and what stays. The warning
// about changes not yet sent comes with the queue (#43).
export function SignOutSheet({ open, onSignOut, onClose }: SignOutSheetProps) {
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
      <div className="edit-form-actions sheet-actions">
        <button type="button" className="edit-form-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="edit-form-save" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </dialog>
  )
}
