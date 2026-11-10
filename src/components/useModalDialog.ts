import { useEffect, useRef } from 'react'

// Opens and closes a native modal <dialog> to match `open`. The browser moves
// focus in, closes it on Escape and returns focus to what opened it.
export function useModalDialog(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return dialog
}
