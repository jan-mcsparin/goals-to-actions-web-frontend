import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './TaskMenu.css'

type TaskMenuProps = {
  taskTitle: string
  onSendToBank: () => void
  onSwap: () => void
}

// A disclosure: "⋯" shows two actions below it. The first tap anywhere else
// only closes it, so it can't also check off a task or open another menu.
// Escape closes it and puts focus back on the button.
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
      if (container.current?.contains(event.target as Node)) return
      setOpen(false)
      swallowClickFromThisTap()
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

// Eats the click that follows the tap which closed the menu. Listens in the
// capture phase on document, so the click never reaches React's handlers.
// A scroll (pointercancel) or the next tap ends the wait, so a tap that never
// became a click can't swallow a later one.
function swallowClickFromThisTap() {
  function swallow(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    stopWaiting()
  }
  function stopWaiting() {
    document.removeEventListener('click', swallow, true)
    document.removeEventListener('pointercancel', stopWaiting, true)
    document.removeEventListener('pointerdown', stopWaiting, true)
  }
  document.addEventListener('click', swallow, true)
  document.addEventListener('pointercancel', stopWaiting, true)
  document.addEventListener('pointerdown', stopWaiting, true)
}
