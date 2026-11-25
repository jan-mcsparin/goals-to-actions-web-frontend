// One aspiration's page, ready to render, plus the ways to manage it. Loads
// through the API client; the layout comes from domain/aspiration.ts. An
// aspiration that isn't there is reported as not found, so the screen can go
// back quietly. Changes show at once; if a save fails, the page is read again
// once the saves on their way are done (useSavesOnTheirWay).
import { useCallback, useRef, useState } from 'react'
import {
  bringBackAspiration,
  deleteAspiration,
  getAspiration,
  moveAspiration,
  retireAspiration,
  updateAspiration,
} from '../api/client.ts'
import type { AspirationDetail, RecurringItem } from '../api/types.ts'
import {
  aspirationPage,
  canSaveName,
  withNameAndWhy,
  type AspirationPage,
  type ItsWork,
  type NameAndWhy,
} from '../domain/aspiration.ts'
import { useDelete, type UseDelete } from './useDelete.ts'
import { useLoaded } from './useLoaded.ts'
import { SAVE_FAILED, useSavesOnTheirWay } from './useSavesOnTheirWay.ts'

const LOAD_FAILED = "Couldn't load this aspiration. Try again in a moment."

export type UseAspiration = {
  page?: AspirationPage
  // What the edit sheet starts from.
  editing?: NameAndWhy
  message?: string
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
  notFound: boolean
  edit: (changes: NameAndWhy) => void
  retire: (itsWork: ItsWork) => Promise<boolean>
  bringBack: () => Promise<void>
  move: (direction: 'up' | 'down') => void
  // The aspiration made by mistake: asked once, then sent. Once it's gone, `deleted` is true and
  // the screen goes to the Aspirations tab.
  deleting: UseDelete<string>
  deleted: boolean
  // For a recurring item's edit sheet (useRecurringEdit).
  recurringItems?: RecurringItem[]
  reload: () => Promise<void>
}

export function useAspiration(aspirationId: string, today: string): UseAspiration {
  const { data: detail, setData: setDetail, message, setMessage, notFound, reload, forget } = useLoaded(
    `aspiration/${aspirationId}`,
    useCallback(() => getAspiration(aspirationId), [aspirationId]),
    LOAD_FAILED,
  )
  const track = useSavesOnTheirWay(reload, setMessage)
  const bringingBack = useRef(false)
  const [deleted, setDeleted] = useState(false)
  const deleting = useDelete<string>({
    send: deleteAspiration,
    done: async () => {
      await forget()
      setDeleted(true)
    },
    failed: setMessage,
  })

  function saveOptimistically(change: (before: AspirationDetail) => AspirationDetail, save: () => Promise<unknown>) {
    if (!detail) return
    setDetail((before) => before && change(before))
    track(save())
  }

  function edit(changes: NameAndWhy) {
    if (!canSaveName(changes.name)) return
    saveOptimistically(
      (before) => ({ ...before, aspiration: withNameAndWhy(before.aspiration, changes) }),
      () => updateAspiration(aspirationId, changes),
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
    const position = detail?.aspiration.position
    if (!detail || position == null) return
    const next = direction === 'up' ? position - 1 : position + 1
    if (next < 1 || next > detail.activeCount) return

    saveOptimistically(
      (before) => ({ ...before, aspiration: { ...before.aspiration, position: next } }),
      () => moveAspiration(aspirationId, direction),
    )
  }

  return {
    page: detail && aspirationPage(detail, today),
    editing: detail && { name: detail.aspiration.name, why: detail.aspiration.why ?? '' },
    message,
    clearMessage: () => setMessage(undefined),
    notFound,
    edit,
    retire,
    bringBack,
    move,
    deleting,
    deleted,
    recurringItems: detail?.recurringItems,
    reload,
  }
}
