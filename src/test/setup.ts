// Runs before each .tsx test file. Vitest globals are off, so RTL can't
// register its own cleanup; unmount rendered trees between tests here.
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// Each test starts with nothing stored on the phone and nothing queued. Imported
// here, not above, so the queue sends through the test file's mocked client.
beforeEach(async () => {
  const [{ resetQueue }, { resetPlanStore }] = await Promise.all([import('../api/queue.ts'), import('../storage/planStore.ts')])
  resetPlanStore()
  resetQueue()
})

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
