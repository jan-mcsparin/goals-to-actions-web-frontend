// This week, ready to render: progress per goal, a line per day, and the bank.
// Drawn from the weeks the phone stored, then the fresh read, with the queue's
// changes replayed on top (ADR-010). Placing a task is queued and shows at once;
// wrapping up needs a connection, and its answer is kept. Rules come from domain/week.ts.
import { useState } from 'react'
import { getWeek, wrapUpWeek } from '../api/client.ts'
import { mondayOfDay, toLocalDay, weekAfter } from '../api/dates.ts'
import { newDeviceId } from '../api/ids.ts'
import { enqueue } from '../api/queue.ts'
import type { Task, Week } from '../api/types.ts'
import {
  daySummaries,
  pickableDays,
  weekProgress,
  weekRange,
  type DaySummary,
  type PickableDay,
  wrapUpLists,
  type ProgressRow,
} from '../domain/week.ts'
import { planStore } from '../storage/planStore.ts'
import { readWeekView, saveWeekView, type WeekViewMode } from '../storage/weekView.ts'
import { useStoredWeeks, type WeeksRead } from './useStoredWeeks.ts'
import { isInBank, weekOf } from '../domain/tasks'

const LOAD_FAILED = "Couldn't load this week. Try again in a moment."
const WRAP_UP_FAILED = "Couldn't wrap up the week. Nothing changed."

export type WeekView = {
  progress: ProgressRow[]
  days: DaySummary[]
  bank: Task[]
  pickableDays: PickableDay[]
}

export type UseWeek = {
  // Known without loading, so they show even when the week can't load.
  title: string
  range: string
  week?: WeekView
  message?: string
  // The toggle shows once next week is open; `view` is the one on show.
  view: WeekViewMode
  canViewNext: boolean
  setView: (view: WeekViewMode) => void
  place: (bankTaskId: string, date: string) => void
  // What the wrap-up sheet lists (titles), and the wrap-up itself. Next week's view offers it.
  wrapUp: { carriesOver: string[]; ends: string[]; confirm: () => void }
}

// The current week, and next week once it's open: as stored, then fresh. The current one
// is the phone's week, or the one after once that has been wrapped up early.
const CURRENT_AND_NEXT: WeeksRead = {
  stored: async () => {
    const phonesWeek = mondayOfDay(toLocalDay(new Date()))
    const own = await planStore().weeks.get(phonesWeek)
    const current = own && !own.isCurrent ? await planStore().weeks.get(weekAfter(phonesWeek)) : own
    if (!current) return []
    const next = current.nextWeekOpen ? await planStore().weeks.get(weekAfter(current.week)) : undefined
    return next ? [current, next] : [current]
  },
  fresh: async () => {
    const current = await getWeek()
    return current.nextWeekOpen ? [current, await getWeek(weekAfter(current.week))] : [current]
  },
}

export function useWeek(today: string): UseWeek {
  const { weeks, message, setMessage, keep } = useStoredWeeks(CURRENT_AND_NEXT, LOAD_FAILED)
  const [chosen, setChosen] = useState(readWeekView)
  const current = weeks?.[0]
  const next = weeks?.[1]
  const canViewNext = next !== undefined
  // A remembered Next week falls back to This week once it's no longer open.
  const view = chosen === 'next' && (canViewNext || !weeks) ? 'next' : 'this'
  const plan = view === 'next' ? next : current

  function setView(next: WeekViewMode) {
    setChosen(next)
    saveWeekView(next)
  }

  // Queued: the task shows on its new day at once, and waits there if it can't be sent.
  function place(bankTaskId: string, date: string) {
    const task = plan?.tasks.find((candidate) => candidate.id === bankTaskId)
    const week = task && weekOf(task)
    if (!week) return
    setMessage(undefined)
    void enqueue({ kind: 'place', id: newDeviceId(), taskId: bankTaskId, week, day: date })
  }

  // No undo, so nothing changes on screen until the API says it's done. It waits for the
  // queue first (api/sendOrder.ts), so it sees every check-off.
  function confirmWrapUp() {
    if (!current) return
    setMessage(undefined)
    wrapUpWeek(current.week)
      .then((wrapped) => {
        keep([wrapped])
        setView('this')
      })
      .catch(() => setMessage(WRAP_UP_FAILED))
  }

  const lists = current ? wrapUpLists(current) : { carriesOver: [], ends: [] }
  const wrapUp = {
    carriesOver: lists.carriesOver.map((task) => task.title),
    ends: lists.ends.map((task) => task.title),
    confirm: confirmWrapUp,
  }
  const monday = view === 'next' ? weekAfter(mondayOfDay(today)) : mondayOfDay(today)
  const range = weekRange(plan?.week ?? monday)
  const title = view === 'next' ? 'Next week' : 'This week'
  return { title, range, week: plan && viewOf(plan, today), message, view, canViewNext, setView, place, wrapUp }
}

function viewOf(plan: Week, today: string): WeekView {
  return {
    progress: weekProgress(plan, today),
    days: daySummaries(plan, today),
    bank: plan.tasks.filter(isInBank),
    pickableDays: pickableDays(plan.week, today),
  }
}
