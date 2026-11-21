// A day's plan, ready to render, plus the actions the screen offers. The day, its "Still
// matter?" cards and the bank are all drawn from the day's week (ADR-010), so a change shows on
// each at once. Changes are saved in the background; if a save fails the task goes back to how
// it was (ADR-004). Rules come from domain/today.ts.
import { useCallback, useRef, useState } from 'react'
import {
  answerStillMatters,
  checkOffTask,
  getWeek,
  moveTaskToBank,
  placeTask,
  swapTasks,
  uncheckTask,
} from '../api/client.ts'
import { mondayOfDay } from '../api/dates.ts'
import type { StillMattersAnswer, Task, Week } from '../api/types.ts'
import {
  bankOf,
  bankRows,
  dayHeading,
  dayOf,
  groupByGoal,
  groupForList,
  progress,
  type Day,
  type Section,
  type TaskRow,
} from '../domain/today.ts'
import { pickableDays, type PickableDay } from '../domain/week.ts'
import { readNotNow, saveNotNow } from '../storage/stillMattersNotNow.ts'
import { readTodayView, saveTodayView, type TodayViewMode } from '../storage/viewPreference.ts'
import { withTaskReplaced } from './planUpdates.ts'
import { useLoaded } from './useLoaded.ts'
import { checkedOff, checkOffAt, inTheBank, isDone, placedOnDay, uncheckedOff, weekOf } from '../domain/tasks'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

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
  pull: (bankTaskId: string) => void
  sendToBank: (taskId: string) => void
  swap: (taskId: string, bankTaskId: string) => void
}

export function useDay(date: string, today: string): UseDay {
  const { data: week, setData: setWeek, message, setMessage } = useLoaded(
    useCallback(() => getWeek(mondayOfDay(date)), [date]),
    LOAD_FAILED,
  )
  const [view, setViewState] = useState(readTodayView)
  const [notNow, setNotNow] = useState(() => readNotNow(today))
  const latestRequest = useRef(new Map<string, number>())
  const plan = week && dayOf(week, date)
  const bank = week && bankOf(week)

  function replaceTask(next: Task) {
    setWeek((previous) => previous && withTaskReplaced(previous, next.id, next))
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

  function pull(bankTaskId: string) {
    const task = bank?.find((candidate) => candidate.id === bankTaskId)
    if (!plan || !task) return
    const taskWeek = weekOf(task)
    if (taskWeek === null) return

    replaceTask(placedOnDay(task, plan.date))
    setMessage(undefined)

    placeTask(bankTaskId, taskWeek, plan.date)
      .then(replaceTask)
      .catch(() => {
        replaceTask(task)
        setMessage(SAVE_FAILED)
      })
  }

  // The card goes at once and comes back if the save fails. A day or a drop that lands on this
  // day's plan changes it too.
  function answer(task: Task, reply: StillMattersAnswer) {
    if (!plan?.stillMatters.some((candidate) => candidate.id === task.id)) return
    replaceTask({ ...task, stillMatters: false })
    setMessage(undefined)

    answerStillMatters(task.id, reply)
      .then((saved) => setWeek((previous) => previous && withAnswered(previous, saved)))
      .catch(() => {
        replaceTask(task)
        setMessage(SAVE_FAILED)
      })
  }

  function askAbout(task: Task): StillMattersAsk {
    const taskWeek = weekOf(task)
    return {
      task,
      days: taskWeek === null ? [] : pickableDays(taskWeek, today),
      keep: () => answer(task, { answer: 'keep' }),
      drop: () => answer(task, { answer: 'drop' }),
      reschedule: (day) => taskWeek !== null && answer(task, { answer: 'schedule', week: taskWeek, day }),
      notNow: () => {
        const ids = [...notNow, task.id]
        setNotNow(ids)
        saveNotNow(today, ids)
      },
    }
  }

  function sendToBank(taskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    if (!before) return
    const taskWeek = weekOf(before)
    if (taskWeek === null) return

    replaceTask(inTheBank(before))
    setMessage(undefined)

    moveTaskToBank(taskId, taskWeek).catch(() => {
      replaceTask(before)
      setMessage(SAVE_FAILED)
    })
  }

  // The bank task takes the swapped task's place, so the day keeps its order.
  function swap(taskId: string, bankTaskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    const bankTask = bank?.find((task) => task.id === bankTaskId)
    if (!plan || !before || !bankTask) return
    const taskWeek = weekOf(before)
    if (taskWeek === null) return

    setWeek((previous) => previous && withSwapped(previous, inTheBank(before), placedOnDay(bankTask, plan.date)))
    setMessage(undefined)

    swapTasks(taskId, { week: taskWeek, bankTaskId, day: plan.date })
      .then((saved) => {
        replaceTask(saved.placed)
        replaceTask(saved.toBank)
      })
      .catch(() => {
        setWeek((previous) => previous && withSwapped(previous, bankTask, before))
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
    bankRows: bank && bankRows(bank),
    pull,
    sendToBank,
    swap,
  }
}

function viewOf(plan: Day, view: TodayViewMode, today: string): DayView {
  const sections = view === 'byGoal' ? groupByGoal(plan) : groupForList(plan)
  return {
    isToday: plan.date === today,
    canPlace: plan.date >= today,
    canCheckOff: mondayOfDay(plan.date) <= mondayOfDay(today),
    progress: progress(plan),
    sections,
  }
}

// The answered task as the week now has it: gone if it was dropped, otherwise where it now is.
function withAnswered(week: Week, saved: Task): Week {
  if (saved.state === 'dropped') return { ...week, tasks: week.tasks.filter((task) => task.id !== saved.id) }
  return withTaskReplaced(week, saved.id, saved)
}

// Two tasks trade places in the week's order, each as given: the day keeps its order, and so
// does the bank.
function withSwapped(week: Week, first: Task, second: Task): Week {
  return {
    ...week,
    tasks: week.tasks.map((task) => (task.id === first.id ? second : task.id === second.id ? first : task)),
  }
}
