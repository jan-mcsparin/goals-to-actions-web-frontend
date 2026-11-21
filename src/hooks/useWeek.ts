// This week, ready to render: progress per goal, a line per day, and the bank.
// Loads through the API client; rules come from domain/week.ts.
import { useState } from 'react'
import { getWeek, placeTask, wrapUpWeek } from '../api/client.ts'
import { mondayOfDay, weekAfter } from '../api/dates.ts'
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
import { withTaskReplaced } from './planUpdates.ts'
import { readWeekView, saveWeekView, type WeekViewMode } from '../storage/weekView.ts'
import { useLoaded } from './useLoaded.ts'
import { isInBank, placedOnDay, weekOf } from '../domain/tasks'

const LOAD_FAILED = "Couldn't load this week. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."
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

// The current week, and next week once it's open.
type Weeks = { current: Week; next?: Week }

async function loadWeeks(): Promise<Weeks> {
  const current = await getWeek()
  return current.nextWeekOpen ? { current, next: await getWeek(weekAfter(current.week)) } : { current }
}

export function useWeek(today: string): UseWeek {
  const { data: weeks, setData: setWeeks, message, setMessage } = useLoaded(loadWeeks, LOAD_FAILED)
  const [chosen, setChosen] = useState(readWeekView)
  const canViewNext = weeks?.next !== undefined
  // A remembered Next week falls back to This week once it's no longer open.
  const view = chosen === 'next' && (canViewNext || !weeks) ? 'next' : 'this'
  const plan = view === 'next' ? weeks?.next : weeks?.current

  function setView(next: WeekViewMode) {
    setChosen(next)
    saveWeekView(next)
  }

  // Shows the task on its new day at once; puts it back in the bank if the save fails.
  function place(bankTaskId: string, date: string) {
    const before = plan?.tasks.find((task) => task.id === bankTaskId)
    if (!before) return
    const week = weekOf(before)
    if (week === null) return

    replaceTask(placedOnDay(before, date))
    setMessage(undefined)

    placeTask(bankTaskId, week, date)
      .then(replaceTask)
      .catch(() => {
        replaceTask(before)
        setMessage(SAVE_FAILED)
      })
  }

  // No undo, so nothing changes on screen until the API says it's done.
  function confirmWrapUp() {
    if (!weeks) return
    setMessage(undefined)
    wrapUpWeek(weeks.current.week)
      .then((current) => {
        setWeeks({ current })
        setView('this')
      })
      .catch(() => setMessage(WRAP_UP_FAILED))
  }

  function replaceTask(next: Task) {
    setWeeks(
      (previous) =>
        previous && {
          current: withTaskReplaced(previous.current, next.id, next),
          next: previous.next && withTaskReplaced(previous.next, next.id, next),
        },
    )
  }

  const lists = weeks ? wrapUpLists(weeks.current) : { carriesOver: [], ends: [] }
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
