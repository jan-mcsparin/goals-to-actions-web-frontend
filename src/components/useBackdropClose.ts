import { useRef, type MouseEvent } from 'react'

// Closes a modal <dialog> on a tap on the dimmed backdrop around it. The
// backdrop isn't an element of its own: a tap there lands on the dialog, at a
// point outside its box. The press and the release must both be outside, so a
// drag that starts in a field and ends off the sheet doesn't close it.
export function useBackdropClose(onClose: () => void) {
  const pressedOutside = useRef(false)

  return {
    onMouseDown: (event: MouseEvent<HTMLDialogElement>) => {
      pressedOutside.current = isOnBackdrop(event)
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      if (pressedOutside.current && isOnBackdrop(event)) onClose()
      pressedOutside.current = false
    },
  }
}

function isOnBackdrop(event: MouseEvent<HTMLDialogElement>): boolean {
  if (event.target !== event.currentTarget) return false
  const box = event.currentTarget.getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  return x < box.left || x > box.right || y < box.top || y > box.bottom
}
