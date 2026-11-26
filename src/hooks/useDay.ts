// A day's plan, ready to render, plus the actions the screen offers. The day, its "Still
// matter?" cards and the bank are all drawn from the day's week (ADR-010): the week the phone
// stored, then the fresh read, with the queue's changes replayed on top. Check off, uncheck,
// pull, back to the bank and swap go into the queue and show at once; they never go back on
// a failed send, they wait. So do a quitting goal's answer and urge rating. "Still matter?" needs a connection: its card goes at once, and
// comes back if the answer can't be saved. Rules come from domain/.
import { useMemo, useState } from 'react'
import { answerStillMatters, deleteTask, getWeek } from '../api/client.ts'
import { mondayOfDay } from '../api/dates.ts'
import { newDeviceId } from '../api/ids.ts'
import { enqueue } from '../api/queue.ts'
import type { StillMattersAnswer, Task, UrgeLevel, Week } from '../api/types.ts'
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
  waitingLine,
} from '../domain/today.ts'
import { quitRows, type QuitRow } from '../domain/quitting.ts'
import { checkOffAt, isDone, weekOf } from '../domain/tasks'
import { pickableDays, weekTitle, type PickableDay } from '../domain/week.ts'
import { planStore } from '../storage/planStore.ts'
import { readNotNow, saveNotNow } from '../storage/stillMattersNotNow.ts'
import { readTodayView, saveTodayView, type TodayViewMode } from '../storage/viewPreference.ts'
import { useDelete, type UseDelete } from './useDelete.ts'
import { useQueue } from './useQueue.ts'
import { useStoredWeeks, type WeeksRead } from './useStoredWeeks.ts'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

export type DayView = {
  isToday: boolean
  // Tasks can be placed on today and later days, not on past ones, nor in a week that hasn't
  // opened (it has no bank).
  canPlace: boolean
  // A day in a week that hasn't started can't be checked off.
  canCheckOff: boolean
  progress: { done: number; total: number }
  sections: Section[]
  // A quitting goal's held-or-not for the day; none on a future day. Not tasks: never counted.
  quitRows: QuitRow[]
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
  // The day's week, as Week titles it: where back goes.
  weekTitle: string
  day?: DayView
  // On Today only, and only what hasn't been waved off for the day.
  asking: StillMattersAsk[]
  // On Today only, while changes wait after a failed send: "3 changes waiting to send".
  waiting?: string
  message?: string
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
  view: TodayViewMode
  setView: (view: TodayViewMode) => void
  toggleDone: (taskId: string) => void
  bankRows?: TaskRow[]
  pull: (bankTaskId: string) => void
  sendToBank: (taskId: string) => void
  swap: (taskId: string, bankTaskId: string) => void
  // A task made by mistake: asked once, then sent; the week is read again once it's gone.
  deleting: UseDelete<Task>
  answerQuitDay: (goalId: string, held: boolean) => void
  // Back to unknown: the answer and its urge rating.
  clearQuitDay: (goalId: string) => void
  // null clears the rating.
  rateUrge: (goalId: string, level: UrgeLevel | null) => void
}

// The day's week: what the phone has of it, and the fresh read.
function weekRead(monday: string): WeeksRead {
  return {
    stored: async () => {
      const stored = await planStore().weeks.get(monday)
      return stored ? [stored] : []
    },
    fresh: async () => [await getWeek(monday)],
  }
}

export function useDay(date: string, today: string): UseDay {
  const monday = mondayOfDay(date)
  const read = useMemo(() => weekRead(monday), [monday])
  const { weeks, message, setMessage, reload } = useStoredWeeks(read, LOAD_FAILED)
  const queue = useQueue()
  const [view, setViewState] = useState(readTodayView)
  const [notNow, setNotNow] = useState(() => readNotNow(today))
  // "Still matter?" answers on their way: their cards are hidden meanwhile.
  const [answering, setAnswering] = useState<string[]>([])
  const week = weeks?.[0]
  const plan = week && dayOf(week, date)
  const bank = week && bankOf(week)
  const deleting = useDelete<Task>({
    send: (task) => deleteTask(task.id),
    done: reload,
    failed: setMessage,
  })

  function setView(next: TodayViewMode) {
    setViewState(next)
    saveTodayView(next)
  }

  // A check-off reads the clock once: the moment shown is the one sent.
  function toggleDone(taskId: string) {
    const task = plan?.tasks.find((candidate) => candidate.id === taskId)
    if (!task) return
    setMessage(undefined)
    void enqueue(
      isDone(task)
        ? { kind: 'uncheck', id: newDeviceId(), taskId }
        : { kind: 'checkOff', id: newDeviceId(), taskId, checkOff: checkOffAt(new Date()) },
    )
  }

  function pull(bankTaskId: string) {
    const task = bank?.find((candidate) => candidate.id === bankTaskId)
    const taskWeek = task && weekOf(task)
    if (!plan || !taskWeek) return
    setMessage(undefined)
    void enqueue({ kind: 'place', id: newDeviceId(), taskId: bankTaskId, week: taskWeek, day: plan.date })
  }

  function sendToBank(taskId: string) {
    const task = plan?.tasks.find((candidate) => candidate.id === taskId)
    const taskWeek = task && weekOf(task)
    if (!taskWeek) return
    setMessage(undefined)
    void enqueue({ kind: 'toBank', id: newDeviceId(), taskId, week: taskWeek })
  }

  // The bank task takes the swapped task's place, so the day keeps its order.
  function swap(taskId: string, bankTaskId: string) {
    const task = plan?.tasks.find((candidate) => candidate.id === taskId)
    const taskWeek = task && weekOf(task)
    if (!plan || !taskWeek || !bank?.some((candidate) => candidate.id === bankTaskId)) return
    setMessage(undefined)
    void enqueue({ kind: 'swap', id: newDeviceId(), taskId, week: taskWeek, bankTaskId, day: plan.date })
  }

  function answerQuitDay(goalId: string, held: boolean) {
    setMessage(undefined)
    void enqueue({ kind: 'answerQuitDay', id: newDeviceId(), goalId, day: date, held })
  }

  function clearQuitDay(goalId: string) {
    const row = week && quitRows(week, date, today).find((candidate) => candidate.goalId === goalId)
    setMessage(undefined)
    void enqueue({ kind: 'clearQuitDay', id: newDeviceId(), goalId, day: date })
    if (row?.urge) void enqueue({ kind: 'clearUrgeRating', id: newDeviceId(), goalId, day: date })
  }

  function rateUrge(goalId: string, level: UrgeLevel | null) {
    setMessage(undefined)
    void enqueue(
      level === null
        ? { kind: 'clearUrgeRating', id: newDeviceId(), goalId, day: date }
        : { kind: 'rateUrge', id: newDeviceId(), goalId, day: date, level },
    )
  }

  // The card goes at once; the week is read again once the answer is saved, so a day or a
  // drop shows where it lands. If it can't be saved, the card comes back.
  function answer(task: Task, reply: StillMattersAnswer) {
    if (!plan?.stillMatters.some((candidate) => candidate.id === task.id)) return
    setAnswering((ids) => [...ids, task.id])
    setMessage(undefined)

    answerStillMatters(task.id, reply)
      .then(reload)
      .catch(() => {
        setAnswering((ids) => ids.filter((id) => id !== task.id))
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

  const asked = (plan?.stillMatters ?? []).filter((task) => !notNow.includes(task.id) && !answering.includes(task.id))
  return {
    heading: dayHeading(date, today),
    weekTitle: weekTitle(monday, week?.isCurrent ? monday : mondayOfDay(today)),
    day: plan && week && viewOf(plan, week, view, today),
    asking: date === today ? asked.map(askAbout) : [],
    waiting: date === today && queue.stalled ? waitingLine(queue.waiting) : undefined,
    message,
    clearMessage: () => setMessage(undefined),
    view,
    setView,
    toggleDone,
    bankRows: bank && bankRows(bank),
    pull,
    sendToBank,
    swap,
    deleting,
    answerQuitDay,
    clearQuitDay,
    rateUrge,
  }
}

function viewOf(plan: Day, week: Week, view: TodayViewMode, today: string): DayView {
  const sections = view === 'byGoal' ? groupByGoal(plan) : groupForList(plan)
  return {
    isToday: plan.date === today,
    canPlace: plan.date >= today && week.status !== 'notOpen',
    canCheckOff: mondayOfDay(plan.date) <= mondayOfDay(today),
    progress: progress(plan),
    sections,
    quitRows: quitRows(week, plan.date, today),
  }
}
