import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

type TaskMenuProps = {
  taskTitle: string
  onSendToBank: () => void
  onSwap: () => void
}

// A disclosure: "⋯" shows two actions below it. A tap anywhere else closes
// it (which also keeps one menu open at a time); Escape closes it and puts
// focus back on the button.
export function TaskMenu({ taskTitle, onSendToBank, onSwap }: TaskMenuProps) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const actionsId = useId()

  // Listens for taps rather than focus changes: iOS Safari doesn't focus
  // buttons on tap, so a blur-based close would never fire there.
  useEffect(() => {
    if (!open) return
    function closeOnOutsideTap(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideTap)
    return () => document.removeEventListener('pointerdown', closeOnOutsideTap)
  }, [open])

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) return
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <div ref={container} className="task-menu" onKeyDown={closeOnEscape}>
      <button
        ref={toggle}
        type="button"
        className="task-menu-toggle"
        aria-label={`More for ${taskTitle}`}
        aria-expanded={open}
        aria-controls={actionsId}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div id={actionsId} className="task-menu-actions">
          <button type="button" onClick={() => choose(onSendToBank)}>
            Back to bank
          </button>
          <button type="button" onClick={() => choose(onSwap)}>
            Swap
          </button>
        </div>
      )}
    </div>
  )
}
