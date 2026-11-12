import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBackdropClose } from './useBackdropClose.ts'
import { useModalDialog } from './useModalDialog.ts'

function Sheet({ onClose }: { onClose: () => void }) {
  const dialog = useModalDialog(true)
  return (
    <dialog ref={dialog} aria-label="Sheet" {...useBackdropClose(onClose)}>
      <input aria-label="Field" />
    </dialog>
  )
}

// jsdom lays nothing out; give the sheet the bottom half of a phone screen.
function renderSheet() {
  const onClose = vi.fn()
  render(<Sheet onClose={onClose} />)
  const sheet = screen.getByRole('dialog', { name: 'Sheet' })
  sheet.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 400, width: 390, height: 444 })
  return { sheet, onClose }
}

function tap(element: HTMLElement, from: { x: number; y: number }, to = from) {
  fireEvent.mouseDown(element, { clientX: from.x, clientY: from.y })
  fireEvent.mouseUp(element, { clientX: to.x, clientY: to.y })
  fireEvent.click(element, { clientX: to.x, clientY: to.y })
}

describe('useBackdropClose', () => {
  it('closes on a tap off the sheet', () => {
    const { sheet, onClose } = renderSheet()

    tap(sheet, { x: 200, y: 100 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("doesn't close on a tap on the sheet's own edge", () => {
    const { sheet, onClose } = renderSheet()

    tap(sheet, { x: 200, y: 410 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it("doesn't close on a tap on something inside the sheet", () => {
    const { onClose } = renderSheet()

    tap(screen.getByRole('textbox', { name: 'Field' }), { x: 200, y: 100 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it("doesn't close when a press inside ends outside, as when dragging out of a field", () => {
    const { sheet, onClose } = renderSheet()

    tap(sheet, { x: 200, y: 500 }, { x: 200, y: 100 })

    expect(onClose).not.toHaveBeenCalled()
  })
})
