import { useEffect, useId } from 'react'
import { useAdd, type AddOrigin, type AddTab, type OnSaved } from '../hooks/useAdd.ts'
import './AddSheet.css'
import './sheet.css'
import { AspirationForm, AspirationSaved } from './AspirationForm.tsx'
import { GoalForm } from './GoalForm.tsx'
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
  onSaved: OnSaved
  // An aspiration saved and the sheet stayed open.
  onChanged: () => void
  onClose: () => void
}

// Opened by the + in the tab bar. What's inside lives only while it's open,
// so each opening starts blank. The tab it opens on marks the field that takes
// focus (data-autofocus): the Task tab's title, or the Goal tab's first type.
// iOS doesn't raise the keyboard for it; it comes up when a field is tapped.
// Close, Escape or a tap off the sheet closes it.
export function AddSheet({ origin, today, onSaved, onChanged, onClose }: AddSheetProps) {
  const open = origin !== undefined
  const dialog = useModalDialog(open)
  const headingId = useId()
  const backdropClose = useBackdropClose(onClose)

  // After useModalDialog's effect, so the dialog is open and can take focus.
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [open, dialog])

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={headingId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={headingId}>Add</h2>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>
      {origin && (
        <AddSheetBody
          origin={origin}
          today={today}
          onSaved={onSaved}
          onChanged={onChanged}
          onClose={onClose}
        />
      )}
    </dialog>
  )
}

type AddSheetBodyProps = {
  origin: AddOrigin
  today: string
  onSaved: OnSaved
  onChanged: () => void
  onClose: () => void
}

function AddSheetBody({ origin, today, onSaved, onChanged, onClose }: AddSheetBodyProps) {
  const add = useAdd(origin, today, { onSaved, onChanged })

  return (
    <>
      <div className="add-tabs" role="group" aria-label="What to add">
        {TABS.map(({ tab, label }) => (
          <button key={tab} type="button" aria-pressed={add.tab === tab} onClick={() => add.setTab(tab)}>
            {label}
          </button>
        ))}
      </div>
      {add.tab === 'task' && (
        <TaskForm
          draft={add.task}
          goals={add.goals}
          goalsMessage={add.goalsMessage}
          canSave={add.canSave}
          message={add.message}
          onChange={add.editTask}
          onSave={() => void add.save()}
        />
      )}
      {add.tab === 'goal' && (
        <GoalForm
          draft={add.goal}
          today={today}
          aspirations={add.aspirations}
          aspirationsMessage={add.aspirationsMessage}
          canSave={add.canSave}
          message={add.message}
          onChange={add.editGoal}
          onSave={() => void add.save()}
        />
      )}
      {add.tab === 'aspiration' &&
        (add.savedAspiration ? (
          <AspirationSaved onAddGoal={add.addGoalForSaved} onDone={onClose} />
        ) : (
          <AspirationForm
            draft={add.aspiration}
            canSave={add.canSave}
            message={add.message}
            onChange={add.editAspiration}
            onSave={() => void add.save()}
          />
        ))}
      {add.tab === 'recurring' && <p className="sheet-note">Coming soon.</p>}
    </>
  )
}
