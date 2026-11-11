// A day's plan, ready to render, plus the actions the screen offers. Changes
// show immediately and are saved in the background; if a save fails the task
// goes back to how it was (ADR-004). Rules come from domain/today.ts.
import { useEffect, useRef, useState } from 'react'
import {
  checkOffTask,
  getBank,
  getDay,
  pullFromBank,
  skipTask,
  swapTask,
  uncheckTask,
} from '../api/client.ts'
import type { Bank, DayPlan, Task } from '../api/types.ts'
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
import { withTaskReplaced } from './planUpdates.ts'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."
const BANK_FAILED = "Couldn't open the bank. Try again in a moment."

export type DayView = {
  isToday: boolean
  // Tasks can be placed on today and later days, not on past ones.
  canPlace: boolean
  progress: { done: number; total: number }
  sections: Section[]
}

export type UseDay = {
  // Known without loading, so it shows even when the day can't load.
  heading: string
  day?: DayView
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

export function useDay(date: string, today: string): UseDay {
  const [plan, setPlan] = useState<DayPlan>()
  const [message, setMessage] = useState<string>()
  const [view, setViewState] = useState(readTodayView)
  const [bank, setBank] = useState<Bank>()
  const [bankFailed, setBankFailed] = useState(false)
  const latestRequest = useRef(new Map<string, number>())
  const latestBankLoad = useRef(0)

  useEffect(() => {
    let current = true
    getDay(date)
      .then((loaded) => current && setPlan(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [date])

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

    const placed: Task = { ...task, status: 'planned', plannedDay: plan.date, placedByHand: true }
    setPlan((previous) => previous && withTaskAppended(withRecordsFrom(previous, bank), placed))
    setBank((previous) => previous && bankWithout(previous, bankTaskId))
    setMessage(undefined)

    pullFromBank(bankTaskId, plan.date)
      .then(replaceTask)
      .catch(() => {
        setPlan((previous) => previous && withoutTask(previous, bankTaskId))
        setBank((previous) => previous && bankWith(previous, task))
        setMessage(SAVE_FAILED)
      })
  }

  // Shown as "Back to bank"; the API calls it skipping.
  function sendToBank(taskId: string) {
    const index = plan?.tasks.findIndex((task) => task.id === taskId) ?? -1
    if (!plan || index === -1) return
    const before = plan.tasks[index]

    setPlan((previous) => previous && withoutTask(previous, taskId))
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

    const placed: Task = { ...bankTask, status: 'planned', plannedDay: plan.date, placedByHand: true }
    setPlan((previous) => previous && withTaskReplaced(withRecordsFrom(previous, bank), taskId, placed))
    setBank((previous) => previous && bankWithout(previous, bankTaskId))
    setMessage(undefined)

    swapTask(taskId, bankTaskId)
      .then((saved) => replaceTask(saved.placed))
      .catch(() => {
        setPlan((previous) => previous && withTaskReplaced(previous, bankTaskId, before))
        setBank((previous) => previous && bankWith(previous, bankTask))
        setMessage(SAVE_FAILED)
      })
  }

  return {
    heading: dayHeading(date, today),
    day: plan && viewOf(plan, view, today),
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

function viewOf(plan: DayPlan, view: TodayViewMode, today: string): DayView {
  const sections = view === 'byGoal' ? groupByGoal(plan) : groupForList(plan)
  return {
    isToday: plan.date === today,
    canPlace: plan.date >= today,
    progress: progress(plan),
    sections,
  }
}

function withTaskAppended(plan: DayPlan, task: Task): DayPlan {
  return { ...plan, tasks: [...plan.tasks, task] }
}

function withTaskAt(plan: DayPlan, task: Task, index: number): DayPlan {
  return { ...plan, tasks: plan.tasks.toSpliced(index, 0, task) }
}

function withoutTask(plan: DayPlan, taskId: string): DayPlan {
  return { ...plan, tasks: plan.tasks.filter((task) => task.id !== taskId) }
}

function bankWith(bank: Bank, task: Task): Bank {
  return { ...bank, tasks: [...bank.tasks, task] }
}

function bankWithout(bank: Bank, taskId: string): Bank {
  return { ...bank, tasks: bank.tasks.filter((task) => task.id !== taskId) }
}

// A pulled task may belong to a goal the day's plan hasn't seen yet.
function withRecordsFrom(plan: DayPlan, bank: Bank): DayPlan {
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
