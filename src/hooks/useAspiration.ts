// One aspiration's page, ready to render, plus the ways to manage it. Loads
// through the API client; the layout comes from domain/aspiration.ts. An
// aspiration that isn't there is reported as not found, so the screen can go
// back quietly. Changes show at once and roll back if the save fails.
import { useEffect, useRef, useState } from 'react'
import { getAspiration, moveAspiration, NotFoundError, updateAspiration } from '../api/client.ts'
import type { AspirationDetail } from '../api/types.ts'
import { aspirationPage, canSaveName, withNameAndWhy, type AspirationPage } from '../domain/aspiration.ts'

const LOAD_FAILED = "Couldn't load this aspiration. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

export type NameAndWhy = { name: string; why: string }

export type UseAspiration = {
  page?: AspirationPage
  // What the edit sheet starts from.
  editing?: NameAndWhy
  message?: string
  notFound: boolean
  edit: (changes: NameAndWhy) => void
  move: (direction: 'up' | 'down') => void
}

export function useAspiration(aspirationId: string, today: string): UseAspiration {
  const [detail, setDetail] = useState<AspirationDetail>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const latestSave = useRef(0)

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
    move,
  }
}
