// The Add sheet's state while it's open: which tab shows, what's typed on each
// (kept across tab switches; the sheet starts over each time it opens), the
// pickers' choices, and saving. A save that works hands the confirmation line,
// and for a goal the screen to open, to onSaved; one that fails keeps the
// sheet open with a calm message. Rules come from domain/add.ts.
import { useEffect, useRef, useState } from 'react'
import { addAspiration, addGoal, addTask, getAspirations } from '../api/client.ts'
import type { Goal } from '../api/types.ts'
import {
  aspirationChoices,
  emptyGoalDraft,
  emptyTaskDraft,
  goalChoices,
  goalConfirmation,
  goalInput,
  goalReady,
  NEW_ASPIRATION,
  taskConfirmation,
  taskInput,
  taskReady,
  type Choice,
  type GoalDraft,
  type Placement,
  type TaskDraft,
} from '../domain/add.ts'
import type { Screen } from './useNavigation.ts'

const SAVE_FAILED = "Couldn't save that. Try again."
const GOALS_FAILED = "Couldn't load your goals. Try again in a moment."
const ASPIRATIONS_FAILED = "Couldn't load your aspirations. Try again in a moment."

export type AddTab = 'task' | 'goal' | 'aspiration' | 'recurring'

// What the screen the sheet was opened over decides.
export type AddOrigin = { placement: Placement }

// Only the Today screen starts a task on today; an opened day doesn't, even
// when it's today.
export function addOriginFor(screen: Screen): AddOrigin {
  return { placement: screen.screen === 'today' ? 'onToday' : 'inBank' }
}

// A new goal's page; back goes to its aspiration, or to the Aspirations tab.
export function newGoalScreen(goal: Goal): Screen {
  const from = goal.aspirationId
    ? ({ screen: 'aspiration', aspirationId: goal.aspirationId } as const)
    : ({ screen: 'aspirations' } as const)
  return { screen: 'goal', goalId: goal.id, from }
}

export type OnSaved = (confirmation: string, open?: Screen) => void

export type UseAdd = {
  tab: AddTab
  setTab: (tab: AddTab) => void
  task: TaskDraft
  editTask: (changes: Partial<TaskDraft>) => void
  goal: GoalDraft
  editGoal: (changes: Partial<GoalDraft>) => void
  goals: Choice[]
  aspirations: Choice[]
  // Shown under a picker when its choices can't load.
  goalsMessage?: string
  aspirationsMessage?: string
  canSave: boolean
  message?: string
  save: () => Promise<void>
}

export function useAdd(origin: AddOrigin, today: string, onSaved: OnSaved): UseAdd {
  const [tab, setTab] = useState<AddTab>('task')
  const [task, setTask] = useState(() => emptyTaskDraft(origin.placement))
  const [goal, setGoal] = useState(emptyGoalDraft)
  const [goals, setGoals] = useState<Choice[]>([])
  const [aspirations, setAspirations] = useState<Choice[]>([])
  const [choicesFailed, setChoicesFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const savingNow = useRef(false)

  // Without the choices, the pickers offer only None and say why; saving
  // still works. Opening the sheet again tries again.
  useEffect(() => {
    let current = true
    getAspirations()
      .then((overview) => {
        if (!current) return
        setGoals(goalChoices(overview.goals))
        setAspirations(aspirationChoices(overview.aspirations))
      })
      .catch(() => current && setChoicesFailed(true))
    return () => {
      current = false
    }
  }, [])

  const ready = (tab === 'task' && taskReady(task)) || (tab === 'goal' && goalReady(goal, today))

  async function save() {
    if (!ready || savingNow.current) return
    savingNow.current = true
    setSaving(true)
    setMessage(undefined)
    try {
      if (tab === 'task') {
        const saved = await addTask(taskInput(task))
        onSaved(taskConfirmation(saved, today))
      } else {
        const saved = await saveGoal()
        onSaved(goalConfirmation(saved.type), newGoalScreen(saved))
      }
    } catch {
      setMessage(SAVE_FAILED)
    } finally {
      savingNow.current = false
      setSaving(false)
    }
  }

  // A new aspiration is saved first. Once it is, it becomes the selection, so
  // trying again after the goal fails doesn't make a second one.
  async function saveGoal() {
    let { aspirationId } = goal
    if (aspirationId === NEW_ASPIRATION) {
      const added = await addAspiration({ name: goal.newAspirationName })
      aspirationId = added.id
      setAspirations((previous) => [...previous, { id: added.id, label: added.name }])
      setGoal((previous) => ({ ...previous, aspirationId: added.id, newAspirationName: '' }))
    }
    return addGoal(goalInput({ ...goal, type: goal.type!, aspirationId }, today))
  }

  return {
    tab,
    setTab,
    task,
    editTask: (changes) => setTask((previous) => ({ ...previous, ...changes })),
    goal,
    editGoal: (changes) => setGoal((previous) => ({ ...previous, ...changes })),
    goals,
    aspirations,
    goalsMessage: choicesFailed ? GOALS_FAILED : undefined,
    aspirationsMessage: choicesFailed ? ASPIRATIONS_FAILED : undefined,
    canSave: ready && !saving,
    message,
    save,
  }
}
