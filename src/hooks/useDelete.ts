// Deleting something made by mistake (spec 038): ask once, then send and wait for the server.
// It isn't queued (ADR-010), so nothing changes on screen until the server has it; then `done`
// reads the screen again or leaves the page. A 404 means it's already gone (deleted on another
// device), which counts as done. Any other failure, offline included, changes nothing and says so.
import { useRef, useState } from 'react'
import { NotFoundError } from '../api/errors.ts'
import { DELETE_FAILED } from '../domain/deleting.ts'

export type UseDelete<T> = {
  // What the sheet is asking about; undefined while it's closed.
  asking?: T
  ask: (target: T) => void
  cancel: () => void
  confirm: () => Promise<void>
}

type DeleteActions<T> = {
  send: (target: T) => Promise<unknown>
  done: (target: T) => void | Promise<void>
  failed: (message: string) => void
}

export function useDelete<T>({ send, done, failed }: DeleteActions<T>): UseDelete<T> {
  const [asking, setAsking] = useState<T>()
  const sending = useRef(false)

  // A second confirm while one is on its way does nothing.
  async function confirm() {
    if (asking === undefined || sending.current) return
    const target = asking
    sending.current = true
    setAsking(undefined)
    try {
      await send(target)
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        failed(DELETE_FAILED)
        return
      }
    } finally {
      sending.current = false
    }
    await done(target)
  }

  return {
    asking,
    ask: setAsking,
    cancel: () => setAsking(undefined),
    confirm,
  }
}
