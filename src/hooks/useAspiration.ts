// One aspiration's page, ready to render, plus the ways to manage it. Loads
// through the API client; the layout comes from domain/aspiration.ts. An
// aspiration that isn't there is reported as not found, so the screen can go
// back quietly. Changes show at once and roll back if the save fails.
import { useEffect, useRef, useState } from 'react'
import {
  bringBackAspiration,
  getAspiration,
  moveAspiration,
  NotFoundError,
  retireAspiration,
  reviewAspiration,
  updateAspiration,
} from '../api/client.ts'
import type { AspirationDetail } from '../api/types.ts'
import {
  aspirationPage,
  canSaveName,
  withNameAndWhy,
  type AspirationPage,
  type ItsWork,
  type NameAndWhy,
} from '../domain/aspiration.ts'

const LOAD_FAILED = "Couldn't load this aspiration. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

export type UseAspiration = {
  page?: AspirationPage
  // What the edit sheet starts from.
  editing?: NameAndWhy
  message?: string
  notFound: boolean
  edit: (changes: NameAndWhy) => void
  review: () => void
  retire: (itsWork: ItsWork) => Promise<boolean>
  bringBack: () => Promise<void>
  move: (direction: 'up' | 'down') => void
}

export function useAspiration(aspirationId: string, today: string): UseAspiration {
  const [detail, setDetail] = useState<AspirationDetail>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const latestSave = useRef(0)
  const bringingBack = useRef(false)

  useEffect(() => {
    let current = true
    getAspiration(aspirationId)
      .then((loaded) => current && setDetail(loaded))
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof NotFoundError) setNotFound(true)
        else setMessage(LOAD_FAILED)
      })
    return () => {
      current = false
    }
  }, [aspirationId])

  // Shows the change, saves it, and puts back what was there if the save
  // fails. Only the newest save may roll back, so quick taps settle on the last.
  function saveOptimistically(change: (before: AspirationDetail) => AspirationDetail, save: () => Promise<unknown>) {
    if (!detail) return
    const before = detail
    const request = ++latestSave.current
    setDetail(change(before))
    setMessage(undefined)
    save().catch(() => {
      if (request !== latestSave.current) return
      setDetail(before)
      setMessage(SAVE_FAILED)
    })
  }

  function edit(changes: NameAndWhy) {
    if (!canSaveName(changes.name)) return
    saveOptimistically(
      (before) => ({ ...before, aspiration: withNameAndWhy(before.aspiration, changes) }),
      () => updateAspiration(aspirationId, changes),
    )
  }

  function review() {
    saveOptimistically(
      (before) => ({ ...before, aspiration: { ...before.aspiration, lastReviewedAt: new Date().toISOString() } }),
      () => reviewAspiration(aspirationId),
    )
  }

  // Rare, and the page is left afterwards, so this waits for the save.
  // Resolves true once it's saved; on failure, the page stays with a message.
  async function retire(itsWork: ItsWork): Promise<boolean> {
    setMessage(undefined)
    try {
      await retireAspiration(aspirationId, itsWork)
      return true
    } catch {
      setMessage(SAVE_FAILED)
      return false
    }
  }

  // Waits for the save, then reloads, so the place in priority and the
  // count of aspirations come from the API. A second tap while it's on its
  // way does nothing.
  async function bringBack(): Promise<void> {
    if (bringingBack.current) return
    bringingBack.current = true
    setMessage(undefined)
    try {
      await bringBackAspiration(aspirationId)
      setDetail(await getAspiration(aspirationId))
    } catch {
      setMessage(SAVE_FAILED)
    } finally {
      bringingBack.current = false
    }
  }

  function move(direction: 'up' | 'down') {
    const position = detail?.aspiration.priority
    if (!detail || position === undefined) return
    const next = direction === 'up' ? position - 1 : position + 1
    if (next < 1 || next > detail.activeCount) return

    saveOptimistically(
      (before) => ({ ...before, aspiration: { ...before.aspiration, priority: next } }),
      () => moveAspiration(aspirationId, direction),
    )
  }

  return {
    page: detail && aspirationPage(detail, today),
    editing: detail && { name: detail.aspiration.name, why: detail.aspiration.why ?? '' },
    message,
    notFound,
    edit,
    review,
    retire,
    bringBack,
    move,
  }
}
