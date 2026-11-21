// What the Week screen shows, worked out from the week read: progress and pacing
// per goal, a line per day, and which days a bank task can go on.
import { addDays, fromLocalDay, toLocalDay } from '../api/dates.ts'
import type { Task, Week, WeekGoal } from '../api/types.ts'
import { inDayOrder, timeLabel } from './today.ts'
import { isDone, isOnDay, isPlanned } from './tasks'

export type Pacing = {
  done: number
  plannedAhead: number
  target: number
  daysLeft: number
}

export type ProgressRow = {
  goalId: string
  title: string
  done: number
  target: number
  pacing: string
}

export type DaySummary = {
  date: string
  weekday: string
  summary: string
  allDone: boolean
  isToday: boolean
  isPast: boolean
}

export type PickableDay = { date: string; label: string }

// Never a warning: behind is only ever "N more to plan".
export function pacingLine({ done, plannedAhead, target, daysLeft }: Pacing): string {
  if (done >= target) return 'Done for the week'
  const days = daysLeftLabel(daysLeft)
  const toPlan = target - done - plannedAhead
  return toPlan <= 0 ? `${days} · on pace` : `${days} · ${toPlan} more to plan`
}

// Today through Sunday.
export function daysLeft(weekOf: string, today: string): number {
  return daysOf(weekOf).filter((day) => day >= today).length
}

export function daysLeftLabel(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'} left`
}

// Done and the target are the API's; this only words the pacing from the tasks still ahead.
export function weekProgress(plan: Week, today: string): ProgressRow[] {
  const left = daysLeft(plan.week, today)
  return byPriority(plan.goals).map((goal) => {
    const plannedAhead = plan.tasks.filter((task) => task.goalId === goal.id && isPlannedOnOrAfter(task, today)).length
    const pacing = { done: goal.progress.done, plannedAhead, target: goal.progress.of, daysLeft: left }
    return {
      goalId: goal.id,
      title: goal.aspiration ? `${goal.label} · ${goal.aspiration.name}` : goal.label,
      done: pacing.done,
      target: pacing.target,
      pacing: pacingLine(pacing),
    }
  })
}

// In their aspiration's priority order; goals under none, or a retired one, last.
function byPriority(goals: WeekGoal[]): WeekGoal[] {
  const priorityOf = (goal: WeekGoal) => goal.aspiration?.position ?? Infinity
  return [...goals].sort((a, b) => priorityOf(a) - priorityOf(b))
}

export function daySummaries(plan: Week, today: string): DaySummary[] {
  return daysOf(plan.week).map((date) => {
    const tasks = inDayOrder(
      plan.tasks.filter((task) => isOnDay(task, date)),
    )
    return {
      date,
      weekday: fromLocalDay(date).toLocaleDateString('en-US', { weekday: 'short' }),
      summary: tasks.length ? tasks.map(summaryTitle).join(' · ') : 'Free day',
      allDone: tasks.length > 0 && tasks.every(isDone),
      isToday: date === today,
      isPast: date < today,
    }
  })
}

// "Nov 9–15", or "Nov 30–Dec 6" when the week crosses into a new month.
export function weekRange(weekOf: string): string {
  const monday = fromLocalDay(weekOf)
  const sunday = addDays(monday, 6)
  const start = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const end = sameMonth
    ? String(sunday.getDate())
    : sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${start}–${end}`
}

// Today, then the rest of the week. Past days aren't offered.
export function pickableDays(weekOf: string, today: string): PickableDay[] {
  return daysOf(weekOf)
    .filter((date) => date >= today)
    .map((date) => ({
      date,
      label: date === today ? 'Today' : fromLocalDay(date).toLocaleDateString('en-US', { weekday: 'long' }),
    }))
}

function daysOf(weekOf: string): string[] {
  const monday = fromLocalDay(weekOf)
  return Array.from({ length: 7 }, (_, offset) => toLocalDay(addDays(monday, offset)))
}

function isPlannedOnOrAfter(task: Task, today: string): boolean {
  return isPlanned(task) && task.plannedDay !== null && task.plannedDay >= today
}

function summaryTitle(task: Task): string {
  return task.timeOfDay ? `${task.title} ${timeLabel(task.timeOfDay)}` : task.title
}

// What the wrap-up sheet lists: each unfinished task by what closing the week does to it, as the
// API says in `atClose` (the phone doesn't work this out).
export function wrapUpLists(plan: Week): { carriesOver: Task[]; ends: Task[] } {
  return {
    carriesOver: plan.tasks.filter((task) => task.atClose === 'carriesOver'),
    ends: plan.tasks.filter((task) => task.atClose === 'ends'),
  }
}
