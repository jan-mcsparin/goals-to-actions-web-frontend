import { useEffect, useRef } from 'react'

// Opens and closes a native modal <dialog> to match `open`. The browser moves
// focus in, closes it on Escape and returns focus to what opened it.
//
// While it's open, it follows the visual viewport, the part of the page the
// on-screen keyboard doesn't cover, and sets --keyboard-inset on the dialog,
// so a bottom sheet (sheet.css) sits above the keyboard on iOS instead of
// under it.
export function useModalDialog(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    const element = dialog.current
    const viewport = window.visualViewport
    if (!open || !element || !viewport) return

    const follow = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      element.style.setProperty('--keyboard-inset', `${Math.round(covered)}px`)
    }
    follow()
    viewport.addEventListener('resize', follow)
    viewport.addEventListener('scroll', follow)
    return () => {
      viewport.removeEventListener('resize', follow)
      viewport.removeEventListener('scroll', follow)
      element.style.removeProperty('--keyboard-inset')
    }
  }, [open])

  return dialog
}
