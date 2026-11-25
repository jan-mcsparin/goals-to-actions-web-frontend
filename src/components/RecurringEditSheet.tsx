import { useId } from 'react'
import type { UseRecurringEdit } from '../hooks/useRecurringEdit.ts'
import { deleteRecurringLine } from '../domain/deleting.ts'
import { DeleteSheet } from './DeleteSheet.tsx'
import { RecurringForm } from './RecurringForm.tsx'
import './RecurringEditSheet.css'
import './sheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type RecurringEditSheetProps = {
  edit: UseRecurringEdit
}

// A recurring item, opened from its list: the Add sheet's form filled in, then Pause or
// Resume, which act at once, and Delete, last, which asks first.
export function RecurringEditSheet({ edit }: RecurringEditSheetProps) {
  const dialog = useModalDialog(edit.isOpen)
  const backdropClose = useBackdropClose(edit.close)
  const titleId = useId()

  return (
    <>
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
              <button type="button" className="recurring-edit-action recurring-edit-delete" onClick={edit.askToDelete}>
                Delete
              </button>
            </div>
          </>
        )}
      </dialog>
      <DeleteSheet
        open={edit.deleting.asking !== undefined}
        question={edit.deleting.asking ? deleteRecurringLine(edit.deleting.asking.name) : ''}
        onDelete={() => void edit.deleting.confirm()}
        onClose={edit.deleting.cancel}
      />
    </>
  )
}
