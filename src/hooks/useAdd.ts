// The Add sheet's state while it's open: which tab shows, what's typed on each
// (kept across tab switches; the sheet starts over each time it opens), the
// goal picker's choices, and saving. A save that works hands the confirmation
// line to onSaved; one that fails keeps the sheet open with a calm message.
// Rules come from domain/add.ts.
import { useEffect, useRef, useState } from 'react'
import { addTask, getAspirations } from '../api/client.ts'
import {
  emptyTaskDraft,
  goalChoices,
  taskConfirmation,
  taskInput,
  taskReady,
  type GoalChoice,
  type Placement,
  type TaskDraft,
} from '../domain/add.ts'
import type { Screen } from './useNavigation.ts'

const SAVE_FAILED = "Couldn't save that. Try again."
const GOALS_FAILED = "Couldn't load your goals. Try again in a moment."

export type AddTab = 'task' | 'goal' | 'aspiration' | 'recurring'

// What the screen the sheet was opened over decides.
export type AddOrigin = { placement: Placement }

// Only the Today screen starts a task on today; an opened day doesn't, even
// when it's today.
export function addOriginFor(screen: Screen): AddOrigin {
  return { placement: screen.screen === 'today' ? 'onToday' : 'inBank' }
}

export type UseAdd = {
  tab: AddTab
  setTab: (tab: AddTab) => void
  task: TaskDraft
  editTask: (changes: Partial<TaskDraft>) => void
  goals: GoalChoice[]
  // Shown under the goal picker when the goals can't load.
  goalsMessage?: string
  canSave: boolean
  message?: string
  save: () => Promise<void>
}

export function useAdd(origin: AddOrigin, today: string, onSaved: (confirmation: string) => void): UseAdd {
  const [tab, setTab] = useState<AddTab>('task')
  const [task, setTask] = useState(() => emptyTaskDraft(origin.placement))
  const [goals, setGoals] = useState<GoalChoice[]>([])
  const [goalsFailed, setGoalsFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const savingNow = useRef(false)

  // Without the goals, the picker offers only None and says why; the task can
  // still be saved. Opening the sheet again tries again.
  useEffect(() => {
    let current = true
    getAspirations()
      .then((overview) => current && setGoals(goalChoices(overview.goals)))
      .catch(() => current && setGoalsFailed(true))
    return () => {
      current = false
    }
  }, [])

  async function save() {
    if (tab !== 'task' || !taskReady(task) || savingNow.current) return
    savingNow.current = true
    setSaving(true)
    setMessage(undefined)
    try {
      const saved = await addTask(taskInput(task))
      onSaved(taskConfirmation(saved, today))
    } catch {
      setMessage(SAVE_FAILED)
    } finally {
      savingNow.current = false
      setSaving(false)
    }
  }

  return {
    tab,
    setTab,
    task,
    editTask: (changes) => setTask((previous) => ({ ...previous, ...changes })),
    goals,
    goalsMessage: goalsFailed ? GOALS_FAILED : undefined,
    canSave: tab === 'task' && taskReady(task) && !saving,
    message,
    save,
  }
}
