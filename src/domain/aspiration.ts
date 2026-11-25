// What one aspiration's page shows, worked out from an AspirationDetail.
// An active aspiration gets its week, goals, recurring items, past goals and
// place in priority; a retired one only what it has seen and what it paused.
// Nothing here paces or warns.
import { fromLocalDay, mondayOfDay } from '../api/dates.ts'
import type { Aspiration, AspirationDetail, Goal, ListedGoal, RecurringItem } from '../api/types.ts'
import { goalProgress, weekCount } from './aspirations.ts'
import { dayLabel } from './goalDetail.ts'
import { daysLeft, daysLeftLabel } from './week.ts'
import { repeatText } from './recurring.ts'

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
  repeat: string
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
    if (!aspiration.retiredOn) throw new Error(`Retired aspiration ${aspiration.id} has no retiredOn`)
    return {
      kind: 'retired',
      ...heading,
      retiredLine: `Retired ${dayLabel(aspiration.retiredOn, today)}`,
      activeGoals: detail.goals.filter((goal) => goal.status === 'active').map((goal) => goalCard(goal, detail)),
      pausedGoals: paused.map((goal) => goalCard(goal, detail)),
      recurring: detail.recurringItems.filter((item) => !item.active).map((item) => recurringRow(item, true)),
      pastGoals,
    }
  }

  const active = detail.goals.filter((goal) => goal.status === 'active')
  const week = weekCount(aspiration.id, detail)
  // Every active aspiration has a position: its place in priority.
  const position = aspiration.position
  if (position === null) throw new Error(`Active aspiration ${aspiration.id} has no position`)
  return {
    kind: 'active',
    ...heading,
    ...(week && {
      week: {
        done: week.done,
        total: week.total,
        label: `${week.done} of ${week.total} · ${daysLeftLabel(daysLeft(mondayOfDay(today), today))}`,
      },
    }),
    activeGoalsLine: `${active.length} active`,
    goals: [...active, ...paused].map((goal) => goalCard(goal, detail)),
    recurring: detail.recurringItems.map((item) => recurringRow(item, !item.active)),
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
// blank why null. A blank name isn't valid; callers check canSaveName first.
export function withNameAndWhy(aspiration: Aspiration, changes: NameAndWhy): Aspiration {
  return { ...aspiration, name: changes.name.trim(), why: changes.why.trim() || null }
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

function goalCard(goal: ListedGoal, detail: AspirationDetail): GoalCard {
  const weekLine = weekLineFor(goal, detail)
  return {
    goalId: goal.id,
    label: goal.label,
    measurableLine: goal.measurableLine,
    progress: goalProgress(goal),
    reached: goal.progress.hit,
    total: goal.progress.of,
    ...(weekLine && { weekLine }),
  }
}

// Building goals only, while active, against the target in force this week (the week read's).
// Done isn't capped, as on Week.
function weekLineFor(goal: Goal, detail: AspirationDetail): string | undefined {
  if (goal.type !== 'building' || goal.status !== 'active') return undefined
  const week = detail.weekGoals.find((candidate) => candidate.id === goal.id)
  if (!week && goal.weeklyTarget) return `From next week: ${goal.weeklyTarget.sessions} ${goal.weeklyTarget.unit}`
  if (!week) return 'No weekly target yet'
  return `This week: ${week.progress.done} of ${week.weeklyTarget.sessions} ${week.weeklyTarget.unit}`
}

function recurringRow(item: RecurringItem, paused: boolean): RecurringRow {
  return { itemId: item.id, name: item.name, repeat: repeatText(item.schedule), paused }
}

function pastGoalRow(goal: Goal): PastGoalRow {
  return { goalId: goal.id, label: goal.label, outcome: goal.status === 'reached' ? 'Reached' : 'Ended' }
}

function isPast(goal: Goal): boolean {
  return goal.status === 'reached' || goal.status === 'ended'
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
