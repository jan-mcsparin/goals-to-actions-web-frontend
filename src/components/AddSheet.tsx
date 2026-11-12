import { useEffect, useId, useRef, type RefObject } from 'react'
import { useAdd, type AddOrigin, type AddTab } from '../hooks/useAdd.ts'
import './AddSheet.css'
import './sheet.css'
import { TaskForm } from './TaskForm.tsx'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

const TABS: { tab: AddTab; label: string }[] = [
  { tab: 'task', label: 'Task' },
  { tab: 'goal', label: 'Goal' },
  { tab: 'aspiration', label: 'Aspiration' },
  { tab: 'recurring', label: 'Recurring' },
]

type AddSheetProps = {
  // Where it was opened from; undefined while closed.
  origin?: AddOrigin
  today: string
  onSaved: (confirmation: string) => void
  onClose: () => void
}

// Opened by the + in the tab bar. What's inside lives only while it's open,
// so each opening starts blank. The title field takes focus, so the keyboard
// is up for the one required field. Close, Escape or a tap off the sheet closes it.
export function AddSheet({ origin, today, onSaved, onClose }: AddSheetProps) {
  const open = origin !== undefined
  const dialog = useModalDialog(open)
  const headingId = useId()
  const titleField = useRef<HTMLInputElement>(null)
  const backdropClose = useBackdropClose(onClose)

  // After useModalDialog's effect, so the dialog is open and can take focus.
  useEffect(() => {
    if (open) titleField.current?.focus()
  }, [open])

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={headingId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={headingId}>Add</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      {origin && <AddSheetBody origin={origin} today={today} titleField={titleField} onSaved={onSaved} />}
    </dialog>
  )
}

type AddSheetBodyProps = {
  origin: AddOrigin
  today: string
  titleField: RefObject<HTMLInputElement | null>
  onSaved: (confirmation: string) => void
}

function AddSheetBody({ origin, today, titleField, onSaved }: AddSheetBodyProps) {
  const add = useAdd(origin, today, onSaved)

  return (
    <>
      <div className="add-tabs" role="group" aria-label="What to add">
        {TABS.map(({ tab, label }) => (
          <button key={tab} type="button" aria-pressed={add.tab === tab} onClick={() => add.setTab(tab)}>
            {label}
          </button>
        ))}
      </div>
      {add.tab === 'task' ? (
        <TaskForm
          draft={add.task}
          goals={add.goals}
          canSave={add.canSave}
          message={add.message}
          titleRef={titleField}
          onChange={add.editTask}
          onSave={() => void add.save()}
        />
      ) : (
        <p className="sheet-note">Coming soon.</p>
      )}
    </>
  )
}
