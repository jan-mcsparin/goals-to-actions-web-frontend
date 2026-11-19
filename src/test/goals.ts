// Goal fixtures for tests: the fields the API sends empty, and weekly targets
// and milestones given per goal, as the older fixtures did.
import type { Goal, ListedGoal, Milestone, WeeklyTarget } from '../api/types.ts'

export const GOAL_DEFAULTS = {
  aspirationId: null,
  baseline: null,
  deadline: null,
  endedOn: null,
  slipped: false,
  weeklyTarget: null,
  createdAt: '2026-10-01T09:00:00Z',
} satisfies Partial<Goal>

export type TargetFor = WeeklyTarget & { goalId: string }

export function countTarget(goalId: string, sessions: number, unit = 'sessions'): TargetFor {
  return { goalId, kind: 'count', sessions, amount: null, unit, effectiveFrom: '2026-10-05' }
}

// Each goal with the target given for it, if any.
export function withTargets(goals: Goal[], targets: TargetFor[] = []): Goal[] {
  return goals.map((goal) => {
    const found = targets.find((target) => target.goalId === goal.id)
    if (!found) return goal
    const { goalId: _goalId, ...weeklyTarget } = found
    return { ...goal, weeklyTarget }
  })
}

// Each goal as listGoals sends it, its progress counted from the milestones
// given, as the API counts it: hits plus the goal, which a reached goal fills.
export function listed(goals: Goal[], milestones: Milestone[] = []): ListedGoal[] {
  return goals.map((goal) => {
    const own = milestones.filter((milestone) => milestone.goalId === goal.id)
    const of = own.length + 1
    const hit = goal.status === 'reached' ? of : own.filter((milestone) => milestone.status === 'hit').length
    return { ...goal, progress: { hit, of } }
  })
}
