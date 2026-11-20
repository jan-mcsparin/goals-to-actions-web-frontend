// A day's plan, ready to render, plus the actions the screen offers. Changes
// show immediately and are saved in the background; if a save fails the task
// goes back to how it was (ADR-004). Rules come from domain/today.ts.
import { useCallback, useRef, useState } from 'react'
import {
  answerStillMatters,
  checkOffTask,
  getBank,
  getDay,
  moveTaskToBank,
  placeTask,
  swapTasks,
  uncheckTask,
} from '../api/client.ts'
import { mondayOfDay } from '../api/dates.ts'
import type { Bank, DayPlan, StillMattersAnswer, Task } from '../api/types.ts'
import {
  bankRows,
  dayHeading,
  groupByGoal,
  groupForList,
  progress,
  type Section,
  type TaskRow,
} from '../domain/today.ts'
import { pickableDays, type PickableDay } from '../domain/week.ts'
import { readNotNow, saveNotNow } from '../storage/stillMattersNotNow.ts'
import { readTodayView, saveTodayView, type TodayViewMode } from '../storage/viewPreference.ts'
import { withTaskReplaced } from './planUpdates.ts'
import { useLoaded } from './useLoaded.ts'
import { checkedOff, checkOffAt, isDone, placedOnDay, uncheckedOff, weekOf } from '../domain/tasks'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."
const BANK_FAILED = "Couldn't open the bank. Try again in a moment."

export type DayView = {
  isToday: boolean
  // Tasks can be placed on today and later days, not on past ones.
  canPlace: boolean
  // A day in a week that hasn't started can't be checked off.
  canCheckOff: boolean
  progress: { done: number; total: number }
  sections: Section[]
}

// Today's "Still matter?" card for one task, and what each answer does.
export type StillMattersAsk = {
  task: Task
  days: PickableDay[]
  keep: () => void
  drop: () => void
  reschedule: (day: string) => void
  notNow: () => void
}

export type UseDay = {
  // Known without loading, so it shows even when the day can't load.
  heading: string
  day?: DayView
  // On Today only, and only what hasn't been waved off for the day.
  asking: StillMattersAsk[]
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
  const { data: plan, setData: setPlan, message, setMessage } = useLoaded(
    useCallback(() => getDay(date), [date]),
    LOAD_FAILED,
  )
  const [view, setViewState] = useState(readTodayView)
  const [notNow, setNotNow] = useState(() => readNotNow(today))
  const [bank, setBank] = useState<Bank>()
  const [bankFailed, setBankFailed] = useState(false)
  const latestRequest = useRef(new Map<string, number>())
  const latestBankLoad = useRef(0)

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

    // A check-off reads the clock once: the moment shown is the one sent.
    const checkOff = isDone(before) ? undefined : checkOffAt(new Date())
    replaceTask(checkOff ? checkedOff(before, checkOff) : uncheckedOff(before))
    setMessage(undefined)
    const isLatest = startRequest(taskId)

    const save = checkOff ? checkOffTask(taskId, checkOff) : uncheckTask(taskId)
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
      const loaded = await getBank(mondayOfDay(date))
      if (load === latestBankLoad.current) setBank(loaded)
    } catch {
      if (load === latestBankLoad.current) setBankFailed(true)
    }
  }

  function pull(bankTaskId: string) {
    const task = bank?.tasks.find((candidate) => candidate.id === bankTaskId)
    if (!bank || !plan || !task) return

    const week = weekOf(task)
    if (week === null) return

    const placed = placedOnDay(task, plan.date)
    setPlan((previous) => previous && withTaskAppended(withRecordsFrom(previous, bank), placed))
    setBank((previous) => previous && bankWithout(previous, bankTaskId))
    setMessage(undefined)

    placeTask(bankTaskId, week, plan.date)
      .then(replaceTask)
      .catch(() => {
        setPlan((previous) => previous && withoutTask(previous, bankTaskId))
        setBank((previous) => previous && bankWith(previous, task))
        setMessage(SAVE_FAILED)
      })
  }

  // The card goes at once and comes back if the save fails. A day or a drop that lands on this
  // day's plan changes it too.
  function answer(task: Task, reply: StillMattersAnswer) {
    const index = plan?.stillMatters.findIndex((candidate) => candidate.id === task.id) ?? -1
    if (!plan || index === -1) return
    setPlan((previous) => previous && { ...previous, stillMatters: previous.stillMatters.filter((item) => item.id !== task.id) })
    setMessage(undefined)

    answerStillMatters(task.id, reply)
      .then((saved) => setPlan((previous) => previous && landed(previous, saved)))
      .catch(() => {
        setPlan((previous) => previous && { ...previous, stillMatters: previous.stillMatters.toSpliced(index, 0, task) })
        setMessage(SAVE_FAILED)
      })
  }

  function askAbout(task: Task): StillMattersAsk {
    const week = weekOf(task)
    return {
      task,
      days: week === null ? [] : pickableDays(week, today),
      keep: () => answer(task, { answer: 'keep' }),
      drop: () => answer(task, { answer: 'drop' }),
      reschedule: (day) => week !== null && answer(task, { answer: 'schedule', week, day }),
      notNow: () => {
        const ids = [...notNow, task.id]
        setNotNow(ids)
        saveNotNow(today, ids)
      },
    }
  }

  function sendToBank(taskId: string) {
    const index = plan?.tasks.findIndex((task) => task.id === taskId) ?? -1
    if (!plan || index === -1) return
    const before = plan.tasks[index]
    const week = weekOf(before)
    if (week === null) return

    setPlan((previous) => previous && withoutTask(previous, taskId))
    setMessage(undefined)

    moveTaskToBank(taskId, week).catch(() => {
      setPlan((previous) => previous && withTaskAt(previous, before, index))
      setMessage(SAVE_FAILED)
    })
  }

  // The bank task takes the swapped task's place, so the day keeps its order.
  function swap(taskId: string, bankTaskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    const bankTask = bank?.tasks.find((task) => task.id === bankTaskId)
    if (!plan || !bank || !before || !bankTask) return
    const week = weekOf(before)
    if (week === null) return

    const placed = placedOnDay(bankTask, plan.date)
    setPlan((previous) => previous && withTaskReplaced(withRecordsFrom(previous, bank), taskId, placed))
    setBank((previous) => previous && bankWithout(previous, bankTaskId))
    setMessage(undefined)

    swapTasks(taskId, { week, bankTaskId, day: plan.date })
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
    asking: date === today ? (plan?.stillMatters ?? []).filter((task) => !notNow.includes(task.id)).map(askAbout) : [],
    message,
    view,
    setView,
    toggleDone,
    bankRows: bank && bankRows(bank.tasks),
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
    canCheckOff: mondayOfDay(plan.date) <= mondayOfDay(today),
    progress: progress(plan),
    sections,
  }
}

// The answered task as the plan now has it: off the day if it left, on it if it landed there.
function landed(plan: DayPlan, saved: Task): DayPlan {
  const without = plan.tasks.filter((task) => task.id !== saved.id)
  const here = saved.state === 'open' && saved.plannedDay === plan.date
  return { ...plan, tasks: here ? [...without, saved] : without }
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
