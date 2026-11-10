// Today's plan, ready to render, plus the actions the screen offers. Changes
// show immediately and are saved in the background; if a save fails the task
// goes back to how it was (ADR-004). Rules come from domain/today.ts.
import { useEffect, useRef, useState } from 'react'
import {
  checkOffTask,
  getBank,
  getToday,
  pullFromBank,
  skipTask,
  swapTask,
  uncheckTask,
} from '../api/client.ts'
import type { Bank, Task, TodayPlan } from '../api/types.ts'
import {
  bankRows,
  dayHeading,
  groupByGoal,
  groupForList,
  progress,
  type Section,
  type TaskRow,
} from '../domain/today.ts'
import { readTodayView, saveTodayView, type TodayViewMode } from '../storage/viewPreference.ts'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."
const BANK_FAILED = "Couldn't open the bank. Try again in a moment."

export type TodayView = {
  heading: string
  progress: { done: number; total: number }
  sections: Section[]
}

export type UseToday = {
  today?: TodayView
  message?: string
  view: TodayViewMode
  setView: (view: TodayViewMode) => void
  toggleDone: (taskId: string) => void
  bankRows?: TaskRow[]
  bankMessage?: string
  loadBank: () => Promise<void>
  pull: (bankTaskId: string) => void
  sendToBank: (taskId: string) => void
  swap: (taskId: string, bankTaskId: string) => void
}

export function useToday(): UseToday {
  const [plan, setPlan] = useState<TodayPlan>()
  const [message, setMessage] = useState<string>()
  const [view, setViewState] = useState(readTodayView)
  const [bank, setBank] = useState<Bank>()
  const [bankFailed, setBankFailed] = useState(false)
  const latestRequest = useRef(new Map<string, number>())
  const latestBankLoad = useRef(0)

  useEffect(() => {
    let current = true
    getToday()
      .then((loaded) => current && setPlan(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [])

  function replaceTask(next: Task) {
    setPlan((previous) => previous && withTaskReplaced(previous, next.id, next))
  }

  // Each tap gets a number; only the newest tap on a task may update it, so
  // quick double taps settle on the last one.
  function startRequest(taskId: string) {
    const request = (latestRequest.current.get(taskId) ?? 0) + 1
    latestRequest.current.set(taskId, request)
    return () => latestRequest.current.get(taskId) === request
  }

  function setView(next: TodayViewMode) {
    setViewState(next)
    saveTodayView(next)
  }

  function toggleDone(taskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    if (!before) return

    const undoing = before.status === 'done'
    replaceTask(undoing ? asPlanned(before) : asDone(before))
    setMessage(undefined)
    const isLatest = startRequest(taskId)

    const save = undoing ? uncheckTask(taskId) : checkOffTask(taskId)
    save
      .then((saved) => isLatest() && replaceTask(saved))
      .catch(() => {
        if (!isLatest()) return
        replaceTask(before)
        setMessage(SAVE_FAILED)
      })
  }

  // Starts from an empty bank each time, so the sheet never shows an old list.
  // Only the newest load may fill it in.
  async function loadBank() {
    const load = ++latestBankLoad.current
    setBank(undefined)
    setBankFailed(false)
    try {
      const loaded = await getBank()
      if (load === latestBankLoad.current) setBank(loaded)
    } catch {
      if (load === latestBankLoad.current) setBankFailed(true)
    }
  }

  function pull(bankTaskId: string) {
    const task = bank?.tasks.find((candidate) => candidate.id === bankTaskId)
    if (!bank || !plan || !task) return

    const placed: Task = { ...task, status: 'planned', plannedDay: plan.date }
    setPlan({ ...withRecordsFrom(plan, bank), tasks: [...plan.tasks, placed] })
    setBank({ ...bank, tasks: bank.tasks.filter((candidate) => candidate.id !== bankTaskId) })
    setMessage(undefined)

    pullFromBank(bankTaskId)
      .then(replaceTask)
      .catch(() => {
        setPlan((previous) => previous && withoutTask(previous, bankTaskId))
        setBank((previous) => previous && { ...previous, tasks: [...previous.tasks, task] })
        setMessage(SAVE_FAILED)
      })
  }

  // Shown as "Back to bank"; the API calls it skipping.
  function sendToBank(taskId: string) {
    const index = plan?.tasks.findIndex((task) => task.id === taskId) ?? -1
    if (!plan || index === -1) return
    const before = plan.tasks[index]

    setPlan(withoutTask(plan, taskId))
    setMessage(undefined)

    skipTask(taskId).catch(() => {
      setPlan((previous) => previous && withTaskAt(previous, before, index))
      setMessage(SAVE_FAILED)
    })
  }

  // The bank task takes the swapped task's place, so the day keeps its order.
  function swap(taskId: string, bankTaskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    const bankTask = bank?.tasks.find((task) => task.id === bankTaskId)
    if (!plan || !bank || !before || !bankTask) return

    const placed: Task = { ...bankTask, status: 'planned', plannedDay: plan.date }
    setPlan(withTaskReplaced(withRecordsFrom(plan, bank), taskId, placed))
    setBank({ ...bank, tasks: bank.tasks.filter((task) => task.id !== bankTaskId) })
    setMessage(undefined)

    swapTask(taskId, bankTaskId)
      .then((saved) => replaceTask(saved.placed))
      .catch(() => {
        setPlan((previous) => previous && withTaskReplaced(previous, bankTaskId, before))
        setBank((previous) => previous && { ...previous, tasks: [...previous.tasks, bankTask] })
        setMessage(SAVE_FAILED)
      })
  }

  return {
    today: plan && viewOf(plan, view),
    message,
    view,
    setView,
    toggleDone,
    bankRows: bank && bankRows(bank),
    bankMessage: bankFailed ? BANK_FAILED : undefined,
    loadBank,
    pull,
    sendToBank,
    swap,
  }
}

function viewOf(plan: TodayPlan, view: TodayViewMode): TodayView {
  const sections = view === 'byGoal' ? groupByGoal(plan) : groupForList(plan)
  return { heading: dayHeading(plan.date), progress: progress(plan), sections }
}

function withTaskAt(plan: TodayPlan, task: Task, index: number): TodayPlan {
  return { ...plan, tasks: plan.tasks.toSpliced(index, 0, task) }
}

function withTaskReplaced(plan: TodayPlan, taskId: string, replacement: Task): TodayPlan {
  return { ...plan, tasks: plan.tasks.map((task) => (task.id === taskId ? replacement : task)) }
}

function withoutTask(plan: TodayPlan, taskId: string): TodayPlan {
  return { ...plan, tasks: plan.tasks.filter((task) => task.id !== taskId) }
}

// A pulled task may belong to a goal today's plan hasn't seen yet.
function withRecordsFrom(plan: TodayPlan, bank: Bank): TodayPlan {
  return {
    ...plan,
    goals: unionById(plan.goals, bank.goals),
    aspirations: unionById(plan.aspirations, bank.aspirations),
    recurringItems: unionById(plan.recurringItems, bank.recurringItems),
  }
}

function unionById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const known = new Set(existing.map((record) => record.id))
  return [...existing, ...incoming.filter((record) => !known.has(record.id))]
}

function asDone(task: Task): Task {
  return { ...task, status: 'done', completedAt: new Date().toISOString() }
}

function asPlanned({ completedAt: _completedAt, valueLogged: _valueLogged, ...task }: Task): Task {
  return { ...task, status: 'planned' }
}
