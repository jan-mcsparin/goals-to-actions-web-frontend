// Runs before each .tsx test file. Vitest globals are off, so RTL can't
// register its own cleanup; unmount rendered trees between tests here.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom has no showModal/close. The browser handles focus, Escape and the
// backdrop; tests only need the dialog to open, close and fire 'close'.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}
