// Any week, ready to render: progress per goal, a line per day, and the bank. The current week
// and an open next week are drawn from the weeks the phone stored, then the fresh read, with the
// queue's changes replayed on top (ADR-010). Every other week is read when shown, online only.
// The arrows go back to the first week with rows and forward 12 weeks. Placing a task is queued
// and shows at once; wrapping up needs a connection, and its answer is kept. Rules come from
// domain/week.ts.
import { useMemo } from 'react'
import { deleteTask, getWeek, wrapUpWeek } from '../api/client.ts'
import { addDays, fromLocalDay, mondayOfDay, toLocalDay, weekAfter } from '../api/dates.ts'
import { newDeviceId } from '../api/ids.ts'
import { enqueue } from '../api/queue.ts'
import type { Task, Week } from '../api/types.ts'
import {
  daySummaries,
  pickableDays,
  weekLimits,
  weekProgress,
  weekRange,
  weekTitle,
  type DaySummary,
  type PickableDay,
  wrapUpLists,
  type ProgressRow,
} from '../domain/week.ts'
import { storedCurrentAndNext } from '../storage/currentWeek.ts'
import { useDelete, type UseDelete } from './useDelete.ts'
import { useStoredWeeks, type WeeksRead } from './useStoredWeeks.ts'
import { isInBank, weekOf } from '../domain/tasks'

const LOAD_FAILED = "Couldn't load this week. Try again in a moment."
const OTHER_FAILED = "Other weeks need a connection. They'll show once you're back online."
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
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
  canGoBack: boolean
  canGoForward: boolean
  // Back or forward a week.
  step: (weeks: -1 | 1) => void
  // Shown when the week on show isn't this one.
  toThisWeek?: () => void
  place: (bankTaskId: string, date: string) => void
  // A bank task made by mistake: asked once, then sent; the week is read again once it's gone.
  deleting: UseDelete<Task>
  // What the wrap-up sheet lists (titles), and the wrap-up itself. Offered on an open next week.
  wrapUp?: { carriesOver: string[]; ends: string[]; confirm: () => void }
}

// The current week, and next week once it's open: as stored, then fresh. The current one
// is the phone's week, or the one after once that has been wrapped up early.
const CURRENT_AND_NEXT: WeeksRead = {
  stored: () => storedCurrentAndNext(),
  fresh: async () => {
    const current = await getWeek()
    return current.nextWeekOpen ? [current, await getWeek(weekAfter(current.week))] : [current]
  },
}

const NOTHING: WeeksRead = { stored: async () => [], fresh: async () => [] }

// Another week: read fresh each time, never from storage.
function otherWeek(monday: string): WeeksRead {
  return { stored: async () => [], fresh: async () => [await getWeek(monday)] }
}

// `shown` is the Monday of the week on show; none means this week. `onShowWeek` changes it.
export function useWeek(today: string, shown: string | undefined, onShowWeek: (week?: string) => void): UseWeek {
  const stored = useStoredWeeks(CURRENT_AND_NEXT, LOAD_FAILED)
  const current = stored.weeks?.[0]
  const next = stored.weeks?.[1]
  const thisWeek = current?.week ?? mondayOfDay(today)
  const limits = current && weekLimits(thisWeek, current.firstWeek ?? null)
  const outOfReach = limits && shown !== undefined && (shown < limits.first || shown > limits.last)
  const monday = shown === undefined || outOfReach ? thisWeek : shown
  // Next week counts as stored until the current week says it isn't open.
  const isStored = monday === thisWeek || (monday === weekAfter(thisWeek) && (!current || next !== undefined))
  const otherRead = useMemo(() => (isStored ? NOTHING : otherWeek(monday)), [isStored, monday])
  const other = useStoredWeeks(otherRead, OTHER_FAILED)
  const source = isStored ? stored : other
  const plan = isStored ? (monday === thisWeek ? current : next) : other.weeks?.[0]
  const deleting = useDelete<Task>({ send: (task) => deleteTask(task.id), done: source.reload, failed: source.setMessage })

  // Queued: the task shows on its new day at once, and waits there if it can't be sent.
  function place(bankTaskId: string, date: string) {
    const task = plan?.tasks.find((candidate) => candidate.id === bankTaskId)
    const week = task && weekOf(task)
    if (!week) return
    source.setMessage(undefined)
    void enqueue({ kind: 'place', id: newDeviceId(), taskId: bankTaskId, week, day: date })
  }

  // No undo, so nothing changes on screen until the API says it's done. It waits for the
  // queue first (api/sendOrder.ts), so it sees every check-off.
  function confirmWrapUp() {
    if (!current) return
    stored.setMessage(undefined)
    wrapUpWeek(current.week)
      .then((wrapped) => stored.keep([wrapped]))
      .catch(() => stored.setMessage(WRAP_UP_FAILED))
  }

  const isOpenNext = next !== undefined && monday === next.week
  const lists = current ? wrapUpLists(current) : { carriesOver: [], ends: [] }
  return {
    title: weekTitle(monday, thisWeek),
    range: weekRange(monday),
    week: plan && viewOf(plan, today),
    message: source.message,
    clearMessage: () => source.setMessage(undefined),
    canGoBack: limits !== undefined && monday > limits.first,
    canGoForward: limits !== undefined && monday < limits.last,
    step: (weeks) => onShowWeek(toLocalDay(addDays(fromLocalDay(monday), weeks * 7))),
    toThisWeek: monday === thisWeek ? undefined : () => onShowWeek(undefined),
    place,
    deleting,
    wrapUp: isOpenNext
      ? {
          carriesOver: lists.carriesOver.map((task) => task.title),
          ends: lists.ends.map((task) => task.title),
          confirm: confirmWrapUp,
        }
      : undefined,
  }
}

function viewOf(plan: Week, today: string): WeekView {
  return {
    progress: weekProgress(plan, today),
    days: daySummaries(plan, today),
    bank: plan.tasks.filter(isInBank),
    pickableDays: pickableDays(plan.week, today),
  }
}
