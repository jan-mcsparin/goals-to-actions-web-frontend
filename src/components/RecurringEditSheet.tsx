import { useId } from 'react'
import type { UseRecurringEdit } from '../hooks/useRecurringEdit.ts'
import { RecurringForm } from './RecurringForm.tsx'
import './RecurringEditSheet.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type RecurringEditSheetProps = {
  edit: UseRecurringEdit
}

// A recurring item, opened from its list: the Add sheet's form filled in, then Pause or
// Resume, which act at once. Delete (038) goes below them.
export function RecurringEditSheet({ edit }: RecurringEditSheetProps) {
  const dialog = useModalDialog(edit.isOpen)
  const backdropClose = useBackdropClose(edit.close)
  const titleId = useId()

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={edit.close} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Edit recurring item</h2>
      </header>
      {edit.isOpen && edit.draft && (
        <>
          <RecurringForm
            draft={edit.draft}
            aspirations={edit.aspirations}
            aspirationsMessage={edit.aspirationsMessage}
            canSave={edit.canSave}
            message={edit.message}
            onChange={edit.change}
            onSave={() => void edit.save()}
            onCancel={edit.close}
          />
          <div className="recurring-edit-more">
            <button type="button" className="recurring-edit-action" onClick={() => void (edit.paused ? edit.resume() : edit.pause())}>
              {edit.paused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
