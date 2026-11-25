// Editing a recurring item from the list it's on: open it filled in, change its name, repeat
// or aspiration, save, pause, resume or delete. Each write waits for the server (not queued, ADR-010);
// once it's done the sheet closes and the screen reads its record again, so the row lands
// where the server put it. A failure keeps the sheet and what was typed, with a message.
// Where this week's tasks go after an edit is the API's (ADR-008); Today and Week read it.
import { useEffect, useRef, useState } from 'react'
import {
  deleteRecurringItem,
  getChoices,
  turnOffRecurringItem,
  turnOnRecurringItem,
  updateRecurringItem,
} from '../api/client.ts'
import type { RecurringItem } from '../api/types.ts'
import {
  aspirationChoices,
  recurringDraftOf,
  recurringEditInput,
  recurringEditReady,
  type Choice,
  type RecurringDraft,
} from '../domain/add.ts'
import { useDelete, type UseDelete } from './useDelete.ts'
import { SAVE_FAILED } from './useSavesOnTheirWay.ts'

const ASPIRATIONS_FAILED = "Couldn't load your aspirations. Try again in a moment."

export type UseRecurringEdit = {
  isOpen: boolean
  open: (itemId: string) => void
  close: () => void
  // While open:
  draft?: RecurringDraft
  change: (changes: Partial<RecurringDraft>) => void
  aspirations: Choice[]
  aspirationsMessage?: string
  canSave: boolean
  paused: boolean
  message?: string
  save: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  // An item made by mistake: the edit sheet gives way to the delete sheet, which asks once.
  // Once it's gone the screen reads its list again; if it can't be deleted, the edit sheet
  // comes back with the message.
  askToDelete: () => void
  deleting: UseDelete<RecurringItem>
}

export function useRecurringEdit(items: RecurringItem[] | undefined, reload: () => Promise<void>): UseRecurringEdit {
  const [itemId, setItemId] = useState<string>()
  const [draft, setDraft] = useState<RecurringDraft>()
  const [message, setMessage] = useState<string>()
  const [aspirations, setAspirations] = useState<Choice[]>([])
  const [choicesFailed, setChoicesFailed] = useState(false)
  const writing = useRef(false)
  const item = items?.find((candidate) => candidate.id === itemId)
  const lastDeleted = useRef<RecurringItem>(undefined)
  const deleting = useDelete<RecurringItem>({
    send: (deleted) => {
      lastDeleted.current = deleted
      return deleteRecurringItem(deleted.id)
    },
    done: reload,
    failed: (failure) => {
      if (!lastDeleted.current) return
      open(lastDeleted.current.id)
      setMessage(failure)
    },
  })

  // Loaded on each opening, as the Add sheet does.
  useEffect(() => {
    if (itemId === undefined) return
    let current = true
    getChoices()
      .then((choices) => current && setAspirations(aspirationChoices(choices.aspirations)))
      .catch(() => current && setChoicesFailed(true))
    return () => {
      current = false
    }
  }, [itemId])

  function open(id: string) {
    const opening = items?.find((candidate) => candidate.id === id)
    if (!opening) return
    setItemId(id)
    setDraft(recurringDraftOf(opening))
    setMessage(undefined)
    setChoicesFailed(false)
  }

  function close() {
    setItemId(undefined)
    setDraft(undefined)
    setMessage(undefined)
  }

  // A second tap while one is on its way does nothing.
  async function write(send: (item: RecurringItem) => Promise<unknown>) {
    if (!item || writing.current) return
    writing.current = true
    setMessage(undefined)
    try {
      await send(item)
      close()
      await reload()
    } catch {
      setMessage(SAVE_FAILED)
    } finally {
      writing.current = false
    }
  }

  const canSave = item !== undefined && draft !== undefined && recurringEditReady(draft, item)

  return {
    isOpen: item !== undefined && draft !== undefined,
    open,
    close,
    draft,
    change: (changes) => {
      setMessage(undefined)
      setDraft((before) => before && { ...before, ...changes })
    },
    aspirations,
    aspirationsMessage: choicesFailed ? ASPIRATIONS_FAILED : undefined,
    canSave,
    paused: item?.active === false,
    message,
    save: () => (canSave && draft ? write((saving) => updateRecurringItem(saving.id, recurringEditInput(draft, saving))) : Promise.resolve()),
    pause: () => write((pausing) => turnOffRecurringItem(pausing.id)),
    resume: () => write((resuming) => turnOnRecurringItem(resuming.id)),
    askToDelete: () => {
      if (!item) return
      close()
      deleting.ask(item)
    },
    deleting,
  }
}
