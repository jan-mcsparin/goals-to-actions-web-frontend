// What the Week screen shows, worked out from the week read: progress and pacing
// per goal, a line per day, and which days a bank task can go on.
import { addDays, fromLocalDay, toLocalDay, weekAfter } from '../api/dates.ts'
import type { DayCounts, Task, Week, WeekCounts, WeekGoal } from '../api/types.ts'
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
  // At the cap set by intensity, as the week read says. A guide only: nothing is refused.
  full: boolean
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
    const tasks = inDayOrder(plan.tasks.filter((task) => wasOnDay(task, date)))
    return {
      date,
      weekday: weekdayOf(date),
      summary: tasks.length ? tasks.map(summaryTitle).join(' · ') : 'Free day',
      allDone: tasks.length > 0 && tasks.every(isDone),
      full: plan.days.some((day) => day.day === date && day.full),
      isToday: date === today,
      isPast: date < today,
    }
  })
}

// A week that hasn't opened: each day's tasks, then what's known of it (product rule 12).
// Never full or done: most of its work isn't placed yet.
export function knownDaySummaries(plan: Week, today: string): DaySummary[] {
  return daysOf(plan.week).map((date) => {
    const known = [
      ...inDayOrder(plan.tasks.filter((task) => isOnDay(task, date))).map(summaryTitle),
      ...plan.occurrences.filter((item) => item.day === date).map((item) => item.title),
      ...plan.checkIns.filter((checkIn) => checkIn.day === date).map((checkIn) => `Check in: ${checkIn.goalLabel}`),
      ...plan.deadlines.filter((deadline) => deadline.day === date).map((deadline) => `Deadline: ${deadline.goalLabel}`),
    ]
    return {
      date,
      weekday: weekdayOf(date),
      summary: known.length ? known.join(' · ') : 'Nothing set yet',
      allDone: false,
      full: false,
      isToday: date === today,
      isPast: date < today,
    }
  })
}

// "This week", "Last week", "Next week", else "Week of Dec 7".
export function weekTitle(week: string, current: string): string {
  if (week === current) return 'This week'
  if (week === weekAfter(current)) return 'Next week'
  if (weekAfter(week) === current) return 'Last week'
  return `Week of ${fromLocalDay(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

// How far the arrows go: back to the first week with rows, forward as far as Coming up.
export const WEEKS_AHEAD = 12

export function weekLimits(current: string, firstWeek: string | null): { first: string; last: string } {
  const first = firstWeek !== null && firstWeek < current ? firstWeek : current
  return { first, last: toLocalDay(addDays(fromLocalDay(current), WEEKS_AHEAD * 7)) }
}

export type Origin = 'goalSessions' | 'upkeep' | 'added'
export type CountPart = { origin: Origin; text: string }
export type Segment = { origin: Origin; share: number }

// "8 for 3 goals · 5 upkeep · 2 added": the three parts always show, so the line keeps its shape.
export function countsLine({ goalSessions, goals, upkeep, added }: WeekCounts): CountPart[] {
  const goalPart = goalSessions === 0 ? '0 for goals' : `${goalSessions} for ${goals} ${goals === 1 ? 'goal' : 'goals'}`
  return [
    { origin: 'goalSessions', text: goalPart },
    { origin: 'upkeep', text: `${upkeep} upkeep` },
    { origin: 'added', text: `${added} added` },
  ]
}

// A typical week, fixed so weeks compare with each other. Past it a bar is just full.
export const TYPICAL_WEEK = 25

// Each origin's share of the bar, in order; full past `against`, never more.
export function barSegments({ goalSessions, upkeep, added }: DayCounts, against: number): Segment[] {
  const whole = Math.max(against, goalSessions + upkeep + added)
  return [
    { origin: 'goalSessions', share: goalSessions / whole },
    { origin: 'upkeep', share: upkeep / whole },
    { origin: 'added', share: added / whole },
  ]
}

export function weekBarLabel(counts: WeekCounts): string {
  return `About ${total(counts)} things, against a typical week of ${TYPICAL_WEEK}`
}

export function dayBarLabel(counts: DayCounts, cap: number): string {
  return `${total(counts)} of ${cap} for a day`
}

function total({ goalSessions, upkeep, added }: DayCounts): number {
  return goalSessions + upkeep + added
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

function weekdayOf(date: string): string {
  return fromLocalDay(date).toLocaleDateString('en-US', { weekday: 'short' })
}

// On the day, or there when its week ended (a past week's rolled-over and lapsed rows).
function wasOnDay(task: Task, date: string): boolean {
  return task.weekOutcome !== null ? task.plannedDay === date : isOnDay(task, date)
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
