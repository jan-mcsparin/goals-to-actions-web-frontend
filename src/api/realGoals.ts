// The goal, milestone and check-in functions of api/client.ts, on the real
// API. Same signatures as the mock ones, so hooks and screens don't know
// which they got. Creates go to an id made here, so sending one again makes
// no second row.
import { newDeviceId } from './ids.ts'
import type { components } from './openapi.ts'
import { request } from './request.ts'
import type { Goal, GoalDetail, ListedGoal, MilestoneEdit, NewGoal, QuitDay, UrgeLevel, WeeklyTargetInput } from './types.ts'

type GoalList = components['schemas']['GoalList']

// A quitting goal's day: the queue's own writes (api/queue.ts), so they don't wait for it.
const QUEUED = { queued: true }

export async function listGoals(): Promise<ListedGoal[]> {
  return (await request<GoalList>('GET', '/goals')).goals
}

export async function getGoal(goalId: string): Promise<GoalDetail> {
  return request('GET', `/goals/${goalId}`)
}

export async function createGoal(goal: NewGoal): Promise<Goal> {
  return request('PUT', `/goals/${newDeviceId()}`, goal)
}

export async function setWeeklyTarget(goalId: string, target: WeeklyTargetInput): Promise<Goal> {
  return request('PUT', `/goals/${goalId}/weekly-target`, target)
}

export async function addMilestone(
  goalId: string,
  milestone: { measurableLine: string; targetDate?: string },
): Promise<GoalDetail> {
  return request('PUT', `/milestones/${newDeviceId()}`, {
    goalId,
    measurableLine: milestone.measurableLine,
    targetDate: milestone.targetDate ?? null,
  })
}

export async function updateMilestone(milestoneId: string, edit: MilestoneEdit): Promise<GoalDetail> {
  return request('PATCH', `/milestones/${milestoneId}`, edit)
}

export async function keepMilestone(milestoneId: string): Promise<GoalDetail> {
  return request('POST', `/milestones/${milestoneId}/keep`)
}

// Without a milestone it's the goal's own line. A blank result is none.
export async function checkIn(
  goalId: string,
  milestoneId: string | null,
  outcome: 'hit' | 'notYet',
  result?: string,
): Promise<GoalDetail> {
  return request('PUT', `/check-ins/${newDeviceId()}`, { goalId, milestoneId, outcome, result: result?.trim() || null })
}

export const pauseGoal = statusChange('pause')
export const resumeGoal = statusChange('resume')
export const endGoal = statusChange('end')
export const markGoalReached = statusChange('mark-reached')
export const reopenGoal = statusChange('reopen')
export const goAgain = statusChange('go-again')

function statusChange(route: 'pause' | 'resume' | 'end' | 'mark-reached' | 'reopen' | 'go-again') {
  return (goalId: string): Promise<Goal> => request('POST', `/goals/${goalId}/${route}`)
}

// Held or not, for any day from the goal's start to today. Answering again replaces it.
export async function answerQuitDay(goalId: string, day: string, held: boolean): Promise<QuitDay> {
  return request('PUT', `/goals/${goalId}/quit-days/${day}`, { held }, QUEUED)
}

// Back to unknown.
export async function clearQuitDay(goalId: string, day: string): Promise<QuitDay> {
  return request('POST', `/goals/${goalId}/quit-days/${day}/clear`, undefined, QUEUED)
}

export async function rateUrge(goalId: string, day: string, level: UrgeLevel): Promise<QuitDay> {
  return request('PUT', `/goals/${goalId}/urges/${day}`, { level }, QUEUED)
}

export async function clearUrgeRating(goalId: string, day: string): Promise<QuitDay> {
  return request('POST', `/goals/${goalId}/urges/${day}/clear`, undefined, QUEUED)
}
