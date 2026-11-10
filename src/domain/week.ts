// What the Week screen shows, worked out from a WeekPlan: progress and pacing
// per goal, a line per day, and which days a bank task can go on.
import { addDays, fromLocalDay, toLocalDay } from '../api/dates.ts'
import type { Goal, Task, WeekPlan } from '../api/types.ts'
import { goalSubline, goalsByPriority, inDayOrder, timeLabel } from './today.ts'

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
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
  const toPlan = target - done - plannedAhead
  return toPlan <= 0 ? `${days} · on pace` : `${days} · ${toPlan} more to plan`
}

export function weekProgress(plan: WeekPlan, today: string): ProgressRow[] {
  const daysLeft = daysOf(plan.weekOf).filter((day) => day >= today).length
  return goalsByPriority(plan).flatMap((goal) => {
    const target = plan.weeklyTargets.find((candidate) => candidate.goalId === goal.id)
    if (!target || goal.type !== 'building') return []
    const goalTasks = plan.tasks.filter((task) => task.goalId === goal.id)
    const done = goalTasks.filter((task) => task.status === 'done').length
    const plannedAhead = goalTasks.filter((task) => isPlannedOnOrAfter(task, today)).length
    return [progressRow(goal, plan, { done, plannedAhead, target: target.amount, daysLeft })]
  })
}

export function daySummaries(plan: WeekPlan, today: string): DaySummary[] {
  return daysOf(plan.weekOf).map((date) => {
    const tasks = inDayOrder(
      plan.tasks.filter((task) => task.plannedDay === date && (task.status === 'planned' || task.status === 'done')),
    )
    return {
      date,
      weekday: fromLocalDay(date).toLocaleDateString('en-US', { weekday: 'short' }),
      summary: tasks.length ? tasks.map(summaryTitle).join(' · ') : 'Free day',
      allDone: tasks.length > 0 && tasks.every((task) => task.status === 'done'),
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
  return task.status === 'planned' && task.plannedDay !== undefined && task.plannedDay >= today
}

function progressRow(goal: Goal, plan: WeekPlan, pacing: Pacing): ProgressRow {
  return {
    goalId: goal.id,
    title: goalSubline(goal, plan.aspirations),
    done: pacing.done,
    target: pacing.target,
    pacing: pacingLine(pacing),
  }
}

function summaryTitle(task: Task): string {
  return task.timeOfDay ? `${task.title} ${timeLabel(task.timeOfDay)}` : task.title
}
