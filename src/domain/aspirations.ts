// What the Aspirations tab shows, worked out from an AspirationsOverview:
// a card per active aspiration in priority order, then goals with no
// aspiration, the Keep life running count and the retired aspirations.
// Nothing here paces or warns.
import { fromLocalDay } from '../api/dates.ts'
import type { Aspiration, AspirationsOverview, Goal, GoalType } from '../api/types.ts'

export type GoalRow = {
  goalId: string
  label: string
  progress: string
}

export type WeekCount = {
  done: number
  total: number
  label: string
}

export type AspirationCard = {
  aspirationId: string
  name: string
  why?: string
  week?: WeekCount
  goals: GoalRow[]
  recurringLine: string
}

export type OtherGoals = {
  goals: GoalRow[]
  past: GoalRow[]
}

export type RetiredAspiration = {
  aspirationId: string
  name: string
}

export type AspirationsView = {
  cards: AspirationCard[]
  otherGoals?: OtherGoals
  upkeepLine: string
  retired: RetiredAspiration[]
  isEmpty: boolean
}

export function aspirationsView(overview: AspirationsOverview): AspirationsView {
  return {
    cards: aspirationCards(overview),
    otherGoals: otherGoals(overview),
    upkeepLine: upkeepLine(overview),
    retired: retiredAspirations(overview),
    isEmpty: overview.aspirations.length === 0 && overview.goals.length === 0,
  }
}

export function aspirationCards(overview: AspirationsOverview): AspirationCard[] {
  return overview.aspirations
    .filter((aspiration) => aspiration.status === 'active')
    .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
    .map((aspiration) => cardFor(aspiration, overview))
}

// total counts the goal itself as the final milestone, so it is never 0.
export function progressLabel(type: GoalType, hit: number, total: number): string {
  return `${type === 'oneOff' ? 'Step' : 'Milestone'} ${hit} of ${total}`
}

// "Milestone 1 of 6", "Step 3 of 6 · by Dec 15", or "Paused".
export function goalProgress(goal: Goal, overview: Pick<AspirationsOverview, 'milestones'>): string {
  if (goal.status === 'paused') return 'Paused'
  const { reached, total } = milestoneCount(goal, overview)
  const label = progressLabel(goal.type, reached, total)
  return goal.type === 'oneOff' && goal.deadline ? `${label} · by ${shortDate(goal.deadline)}` : label
}

// Milestones hit, plus the goal itself (the last milestone) once reached.
export function milestoneCount(
  goal: Goal,
  overview: Pick<AspirationsOverview, 'milestones'>,
): { reached: number; total: number } {
  const milestones = overview.milestones.filter((milestone) => milestone.goalId === goal.id)
  const hit = milestones.filter((milestone) => milestone.status === 'hit').length
  return { reached: hit + (goal.status === 'reached' ? 1 : 0), total: milestones.length + 1 }
}

// Sessions done against the week's targets, across the aspiration's active
// building goals. Each goal counts up to its own target, so one goal done
// twice over can't hide another. No unit: the goals count different things.
export function weekCount(
  aspirationId: string,
  overview: Pick<AspirationsOverview, 'goals' | 'weeklyTargets' | 'weekTasks'>,
): WeekCount | undefined {
  const counted = overview.goals.flatMap((goal) => {
    if (goal.aspirationId !== aspirationId || goal.status !== 'active' || goal.type !== 'building') return []
    const target = overview.weeklyTargets.find((candidate) => candidate.goalId === goal.id)
    if (!target) return []
    const done = overview.weekTasks.filter((task) => task.goalId === goal.id && task.status === 'done').length
    return [{ done: Math.min(done, target.amount), total: target.amount }]
  })
  if (counted.length === 0) return undefined

  const done = sum(counted.map((goal) => goal.done))
  const total = sum(counted.map((goal) => goal.total))
  return { done, total, label: `${done} of ${total} this week` }
}

// Goals with no aspiration; their reached and ended goals are kept apart.
// An active goal whose aspiration is retired (resumed on its own) shows here
// too, until the aspiration is brought back.
export function otherGoals(overview: AspirationsOverview): OtherGoals | undefined {
  const retiredIds = new Set(
    overview.aspirations.filter((aspiration) => aspiration.status === 'retired').map((aspiration) => aspiration.id),
  )
  const loose = overview.goals.filter(
    (goal) =>
      goal.aspirationId === undefined || (goal.status === 'active' && retiredIds.has(goal.aspirationId)),
  )
  if (loose.length === 0) return undefined
  return {
    goals: loose.filter(isCurrent).map((goal) => rowFor(goal, overview)),
    past: loose.filter((goal) => !isCurrent(goal)).map((goal) => rowFor(goal, overview)),
  }
}

// The recurring items under no aspiration, as the Keep life running row says it.
export function upkeepLine(overview: Pick<AspirationsOverview, 'recurringItems'>): string {
  const count = overview.recurringItems.filter((item) => item.active && item.aspirationId === undefined).length
  return count === 0 ? 'No recurring items' : `${count} recurring`
}

export function retiredAspirations(overview: Pick<AspirationsOverview, 'aspirations'>): RetiredAspiration[] {
  return overview.aspirations
    .filter((aspiration) => aspiration.status === 'retired')
    .map(({ id, name }) => ({ aspirationId: id, name }))
}

function cardFor(aspiration: Aspiration, overview: AspirationsOverview): AspirationCard {
  const week = weekCount(aspiration.id, overview)
  return {
    aspirationId: aspiration.id,
    name: aspiration.name,
    ...(aspiration.why && { why: aspiration.why }),
    ...(week && { week }),
    goals: overview.goals
      .filter((goal) => goal.aspirationId === aspiration.id && isCurrent(goal))
      .map((goal) => rowFor(goal, overview)),
    recurringLine: recurringLine(aspiration.id, overview),
  }
}

function rowFor(goal: Goal, overview: AspirationsOverview): GoalRow {
  return { goalId: goal.id, label: goal.label, progress: goalProgress(goal, overview) }
}

function recurringLine(aspirationId: string, overview: AspirationsOverview): string {
  const names = overview.recurringItems
    .filter((item) => item.active && item.aspirationId === aspirationId)
    .map((item) => item.name)
  return names.length === 0 ? 'No recurring items' : `${names.length} recurring: ${names.join(', ')}`
}

function isCurrent(goal: Goal): boolean {
  return goal.status === 'active' || goal.status === 'paused'
}

function shortDate(day: string): string {
  return fromLocalDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
