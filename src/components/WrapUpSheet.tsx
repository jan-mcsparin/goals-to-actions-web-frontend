import { useId } from 'react'
import './sheet.css'
import './WrapUpSheet.css'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

type WrapUpSheetProps = {
  open: boolean
  // Titles of what's still open: what moves to next week's bank, and what ends with the week.
  carriesOver: string[]
  ends: string[]
  onConfirm: () => void
  onClose: () => void
}

export function WrapUpSheet({ open, carriesOver, ends, onConfirm, onClose }: WrapUpSheetProps) {
  const dialog = useModalDialog(open)
  const backdropClose = useBackdropClose(onClose)
  const titleId = useId()
  const nothingLeft = carriesOver.length === 0 && ends.length === 0

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose} {...backdropClose}>
      <header className="sheet-header">
        <h2 id={titleId}>Wrap up this week?</h2>
      </header>
      <div className="wrap-up">
        <p className="wrap-up-intro">Next week becomes this week. This can’t be undone.</p>
        {nothingLeft && <p>Everything is done. Nothing to carry over.</p>}
        <TitleList heading="Carries over to next week" titles={carriesOver} />
        <TitleList heading="Ends with this week" titles={ends} />
        <button type="button" className="wrap-up-confirm" onClick={onConfirm}>
          Wrap up this week
        </button>
        <button type="button" className="wrap-up-cancel" onClick={onClose}>
          Not yet
        </button>
      </div>
    </dialog>
  )
}

// Left out when empty.
function TitleList({ heading, titles }: { heading: string; titles: string[] }) {
  const headingId = useId()
  if (titles.length === 0) return null
  return (
    <section className="wrap-up-list" aria-labelledby={headingId}>
      <h3 id={headingId}>{heading}</h3>
      <ul>
        {titles.map((title, index) => (
          <li key={`${index}-${title}`}>{title}</li>
        ))}
      </ul>
    </section>
  )
}
