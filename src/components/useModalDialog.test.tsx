import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useModalDialog } from './useModalDialog.ts'

function Sheet({ open }: { open: boolean }) {
  const dialog = useModalDialog(open)
  return (
    <dialog ref={dialog} data-testid="sheet">
      <input aria-label="Field" />
    </dialog>
  )
}

// A stand-in for window.visualViewport: the part of the page not covered by
// the on-screen keyboard.
function fakeViewport(height: number) {
  const viewport = Object.assign(new EventTarget(), { height, offsetTop: 0 })
  vi.stubGlobal('visualViewport', viewport)
  return viewport
}

function keyboardInset(element: HTMLElement) {
  return element.style.getPropertyValue('--keyboard-inset')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useModalDialog', () => {
  it('opens and closes the dialog with `open`', () => {
    const { getByTestId, rerender } = render(<Sheet open={false} />)
    const sheet = getByTestId('sheet') as HTMLDialogElement
    expect(sheet.open).toBe(false)

    rerender(<Sheet open />)
    expect(sheet.open).toBe(true)

    rerender(<Sheet open={false} />)
    expect(sheet.open).toBe(false)
  })

  it('lifts an open sheet above the keyboard, and lets it down again', () => {
    const viewport = fakeViewport(window.innerHeight)
    const { getByTestId, rerender } = render(<Sheet open />)
    const sheet = getByTestId('sheet')
    expect(keyboardInset(sheet)).toBe('0px')

    act(() => {
      viewport.height = window.innerHeight - 300
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(keyboardInset(sheet)).toBe('300px')

    act(() => {
      viewport.height = window.innerHeight
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(keyboardInset(sheet)).toBe('0px')

    rerender(<Sheet open={false} />)
    act(() => {
      viewport.height = window.innerHeight - 300
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(keyboardInset(sheet)).toBe('')
  })

  it('works where there is no visualViewport', () => {
    vi.stubGlobal('visualViewport', undefined)

    const { getByTestId } = render(<Sheet open />)

    expect((getByTestId('sheet') as HTMLDialogElement).open).toBe(true)
  })
})
