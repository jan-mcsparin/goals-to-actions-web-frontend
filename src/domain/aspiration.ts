// What one aspiration's page shows, worked out from an AspirationDetail.
// An active aspiration gets its week, goals, recurring items, past goals and
// place in priority; a retired one only what it has seen and what it paused.
// Nothing here paces or warns.
import { fromLocalDay, mondayOf, toLocalDay } from '../api/dates.ts'
import type { Aspiration, AspirationDetail, Goal, RecurringItem } from '../api/types.ts'
import { goalProgress, milestoneCount, weekCount } from './aspirations.ts'
import { daysLeft, daysLeftLabel } from './week.ts'

export type GoalCard = {
  goalId: string
  label: string
  measurableLine: string
  progress: string
  reached: number
  total: number
  weekLine?: string
}

export type RecurringRow = {
  itemId: string
  name: string
  repeatRule: string
  paused: boolean
}

export type PastGoalRow = {
  goalId: string
  label: string
  outcome: 'Reached' | 'Ended'
}

export type ActivePage = {
  kind: 'active'
  aspirationId: string
  name: string
  why?: string
  week?: { done: number; total: number; label: string }
  activeGoalsLine: string
  goals: GoalCard[]
  recurring: RecurringRow[]
  pastGoals: PastGoalRow[]
  priority: { line: string; hint: string; canMoveUp: boolean; canMoveDown: boolean }
  historyLine: string
}

export type RetiredPage = {
  kind: 'retired'
  aspirationId: string
  name: string
  why?: string
  retiredLine: string
  activeGoals: GoalCard[] // resumed on their own after it was retired
  pausedGoals: GoalCard[]
  recurring: RecurringRow[]
  pastGoals: PastGoalRow[]
}

export type AspirationPage = ActivePage | RetiredPage

export function aspirationPage(detail: AspirationDetail, today: string): AspirationPage {
  const { aspiration } = detail
  const heading = {
    aspirationId: aspiration.id,
    name: aspiration.name,
    ...(aspiration.why && { why: aspiration.why }),
  }
  const pastGoals = detail.goals.filter(isPast).map(pastGoalRow)
  const paused = detail.goals.filter((goal) => goal.status === 'paused')

  if (aspiration.status === 'retired') {
    if (!aspiration.retiredAt) throw new Error(`Retired aspiration ${aspiration.id} has no retiredAt`)
    return {
      kind: 'retired',
      ...heading,
      retiredLine: `Retired ${dayLabel(aspiration.retiredAt, today)}`,
      activeGoals: detail.goals.filter((goal) => goal.status === 'active').map((goal) => goalCard(goal, detail)),
      pausedGoals: paused.map((goal) => goalCard(goal, detail)),
      recurring: detail.recurringItems.filter((item) => !item.active).map((item) => recurringRow(item, true)),
      pastGoals,
    }
  }

  const active = detail.goals.filter((goal) => goal.status === 'active')
  const week = weekCount(aspiration.id, detail)
  // Every active aspiration has a priority, and it's its position.
  const position = aspiration.priority
  if (position === undefined) throw new Error(`Active aspiration ${aspiration.id} has no priority`)
  return {
    kind: 'active',
    ...heading,
    ...(week && {
      week: {
        done: week.done,
        total: week.total,
        label: `${week.done} of ${week.total} · ${daysLeftLabel(daysLeft(weekOf(today), today))}`,
      },
    }),
    activeGoalsLine: `${active.length} active`,
    goals: [...active, ...paused].map((goal) => goalCard(goal, detail)),
    recurring: detail.recurringItems.filter((item) => item.active).map((item) => recurringRow(item, false)),
    pastGoals,
    priority: {
      line: priorityLine(position, detail.activeCount),
      hint: position === 1 ? 'Comes first when goals compete for time' : 'Higher ones come first when goals compete for time',
      canMoveUp: position > 1,
      canMoveDown: position < detail.activeCount,
    },
    historyLine: historyLine(detail, today),
  }
}

export type NameAndWhy = { name: string; why: string }

// What retiring does with the aspiration's goals and recurring items.
export type ItsWork = 'pause' | 'keep'

// The aspiration as an edit leaves it, as the API saves it: both trimmed, a
// blank why removed. A blank name isn't valid; callers check canSaveName first.
export function withNameAndWhy(aspiration: Aspiration, changes: NameAndWhy): Aspiration {
  const { why: _oldWhy, ...rest } = aspiration
  const why = changes.why.trim()
  return { ...rest, name: changes.name.trim(), ...(why && { why }) }
}

export function canSaveName(name: string): boolean {
  return name.trim() !== ''
}

export function priorityLine(position: number, activeCount: number): string {
  return `${ordinal(position)} of ${activeCount} ${activeCount === 1 ? 'aspiration' : 'aspirations'}`
}

// "Since March: 1 goal reached, 3 goals active, 2 recurring items." Zeros are
// left out; the year shows only when it isn't this year.
export function historyLine(detail: AspirationDetail, today: string): string {
  const reached = detail.goals.filter((goal) => goal.status === 'reached').length
  const active = detail.goals.filter((goal) => goal.status === 'active').length
  const recurring = detail.recurringItems.filter((item) => item.active).length
  const parts = [
    reached && `${counted(reached, 'goal')} reached`,
    active && `${counted(active, 'goal')} active`,
    recurring && counted(recurring, 'recurring item'),
  ].filter(Boolean)

  const created = new Date(detail.aspiration.createdAt)
  const sameYear = created.getFullYear() === fromLocalDay(today).getFullYear()
  const since = created.toLocaleDateString('en-US', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })
  return parts.length ? `Since ${since}: ${parts.join(', ')}.` : `Since ${since}.`
}

function goalCard(goal: Goal, detail: AspirationDetail): GoalCard {
  const weekLine = weekLineFor(goal, detail)
  return {
    goalId: goal.id,
    label: goal.label,
    measurableLine: goal.measurableLine,
    progress: goalProgress(goal, detail),
    ...milestoneCount(goal, detail),
    ...(weekLine && { weekLine }),
  }
}

// Building goals only, while active. Done isn't capped, as on Week.
function weekLineFor(goal: Goal, detail: AspirationDetail): string | undefined {
  if (goal.type !== 'building' || goal.status !== 'active') return undefined
  const target = detail.weeklyTargets.find((candidate) => candidate.goalId === goal.id)
  if (!target) return 'No weekly target yet'
  const done = detail.weekTasks.filter((task) => task.goalId === goal.id && task.status === 'done').length
  return `This week: ${done} of ${target.amount} ${target.unit}`
}

function recurringRow(item: RecurringItem, paused: boolean): RecurringRow {
  return { itemId: item.id, name: item.name, repeatRule: item.repeatRule, paused }
}

function pastGoalRow(goal: Goal): PastGoalRow {
  return { goalId: goal.id, label: goal.label, outcome: goal.status === 'reached' ? 'Reached' : 'Ended' }
}

function isPast(goal: Goal): boolean {
  return goal.status === 'reached' || goal.status === 'ended'
}

function weekOf(today: string): string {
  return toLocalDay(mondayOf(fromLocalDay(today)))
}

// "Nov 10", or "Sep 15, 2025" in another year.
function dayLabel(instant: string, today: string): string {
  const date = new Date(instant)
  const sameYear = date.getFullYear() === fromLocalDay(today).getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}

function counted(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

function ordinal(position: number): string {
  const lastTwo = position % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[position % 10] ?? 'th'
  return `${position}${suffix}`
}
