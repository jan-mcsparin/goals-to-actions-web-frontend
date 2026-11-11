// What one goal's page shows, worked out from a GoalDetail: the header, where
// it started, the timeline from Start to the goal itself, the weekly target,
// the next check-in and, while a milestone is not yet, the card that leads
// with progress. Also the push-out rule for moving a milestone's date.
// Nothing here paces or warns: a passed date reads like any other.
import { addDays, fromLocalDay, mondayOf, toLocalDay } from '../api/dates.ts'
import type { Goal, GoalDetail, GoalType, Milestone, MilestoneStatus } from '../api/types.ts'
import { milestoneCount } from './aspirations.ts'

export type Header = {
  goalId: string
  label: string
  measurableLine: string
  typeLabel: string
  paused: boolean
  aspiration?: { aspirationId: string; name: string }
}

export type Started = {
  startedAt: string
  latest?: string
}

export type StartRow = {
  kind: 'start'
  when: string
  baseline?: string
}

export type MilestoneRow = {
  kind: 'milestone'
  milestoneId: string
  measurableLine: string
  when: string
  status: MilestoneStatus
  result?: string
  next: boolean
  checkable: boolean
}

// The final milestone: the goal's own measurable line. Not a Milestone record.
export type GoalEndRow = {
  kind: 'goal'
  measurableLine: string
  when?: string
  status: 'hit' | 'upcoming'
  next: boolean
  checkable: boolean
}

export type TimelineRow = StartRow | MilestoneRow | GoalEndRow

export type Timeline = {
  heading: 'Milestones' | 'Steps'
  count: string
  rows: TimelineRow[]
}

export type TargetSection = { kind: 'weekly'; line: string; action: 'Edit' | 'Set' } | { kind: 'note'; line: string }

// Without a milestoneId, the next check-in is the goal itself.
export type NextCheckIn = {
  milestoneId?: string
  measurableLine: string
  when: string
}

export type NotYetCard = {
  milestoneId: string
  measurableLine: string
  targetDate?: string
  progress?: string
}

type PageBase = {
  header: Header
  started?: Started
  timeline: Timeline
}

export type CurrentPage = PageBase & {
  kind: 'current'
  target?: TargetSection
  nextCheckIn: NextCheckIn
  notYet?: NotYetCard
}

export type ReachedPage = PageBase & {
  kind: 'reached'
  reachedLine: string
  whatsNext?: string
}

export type EndedPage = PageBase & {
  kind: 'ended'
  achievement: string
}

export type GoalPage = CurrentPage | ReachedPage | EndedPage

export function goalPage(detail: GoalDetail, today: string): GoalPage {
  const { goal } = detail
  const started = startedLines(detail)
  const base = { header: header(detail), ...(started && { started }), timeline: timeline(detail) }

  if (goal.status === 'reached' || goal.status === 'ended') {
    if (!goal.endedAt) throw new Error(`Goal ${goal.id} is ${goal.status} but has no endedAt`)
    if (goal.status === 'ended') return { kind: 'ended', ...base, achievement: achievementLine(detail) }
    return {
      kind: 'reached',
      ...base,
      reachedLine: `Reached ${dayLabel(goal.endedAt, today)}`,
      ...(detail.aspiration && { whatsNext: `What’s next for ${detail.aspiration.name}?` }),
    }
  }

  const target = targetSection(detail)
  const notYet = notYetCard(detail)
  return {
    kind: 'current',
    ...base,
    ...(target && { target }),
    nextCheckIn: nextCheckIn(detail),
    ...(notYet && { notYet }),
  }
}

// "Wk 9 · Nov 30": Monday-start weeks, the goal's first week is Wk 1.
export function weekLabel(startDate: string, targetDate: string | undefined): string {
  if (!targetDate) return 'No date'
  return `Wk ${weekNumber(startDate, targetDate)} · ${shortDate(targetDate)}`
}

// "2 of 6 milestones hit", "2 of 6 steps done". The goal counts as the last.
export function achievementLine(detail: GoalDetail): string {
  const { reached, total } = milestoneCount(detail.goal, detail)
  return detail.goal.type === 'oneOff' ? `${reached} of ${total} steps done` : `${reached} of ${total} milestones hit`
}

// The goal's milestones after one is given a new date. Moving a building or
// quitting goal's milestone later moves every later dated milestone not yet
// hit by the same number of days. Nothing goes past the deadline, moving
// earlier pulls nothing in, and a one-off goal's steps move on their own.
export function pushedDates(goal: Goal, milestones: Milestone[], movedId: string, newDate: string): Milestone[] {
  const movedIndex = milestones.findIndex((milestone) => milestone.id === movedId)
  if (movedIndex === -1) throw new Error(`No milestone ${movedId} on goal ${goal.id}`)
  const capped = (day: string) => (goal.deadline && day > goal.deadline ? goal.deadline : day)

  const oldDate = milestones[movedIndex].targetDate
  const newCapped = capped(newDate)
  const shift = oldDate && goal.type !== 'oneOff' ? daysBetween(oldDate, newCapped) : 0

  return milestones.map((milestone, index) => {
    if (index === movedIndex) return { ...milestone, targetDate: newCapped }
    const pushes = shift > 0 && index > movedIndex && milestone.targetDate && milestone.status !== 'hit'
    if (!pushes) return { ...milestone }
    return { ...milestone, targetDate: capped(plusDays(milestone.targetDate!, shift)) }
  })
}

function header({ goal, aspiration }: GoalDetail): Header {
  return {
    goalId: goal.id,
    label: goal.label,
    measurableLine: goal.measurableLine,
    typeLabel: TYPE_LABELS[goal.type],
    paused: goal.status === 'paused',
    ...(aspiration && { aspiration: { aspirationId: aspiration.id, name: aspiration.name } }),
  }
}

const TYPE_LABELS: Record<GoalType, string> = { building: 'Building', quitting: 'Quitting', oneOff: 'One-off' }

function startedLines({ goal, milestones }: GoalDetail): Started | undefined {
  if (!goal.baseline) return undefined
  const latest = latestResult(milestones)
  return {
    startedAt: `Started at: ${goal.baseline}`,
    ...(latest && { latest: `Latest: ${latest.result} · ${shortDate(latest.checkedInOn!)}` }),
  }
}

// The most recent check-in with a result; on the same day, the later milestone.
function latestResult(milestones: Milestone[]): Milestone | undefined {
  return milestones
    .filter((milestone) => milestone.result && milestone.checkedInOn)
    .reduce<Milestone | undefined>(
      (latest, milestone) => (!latest || milestone.checkedInOn! >= latest.checkedInOn! ? milestone : latest),
      undefined,
    )
}

function timeline(detail: GoalDetail): Timeline {
  const { goal, milestones } = detail
  const oneOff = goal.type === 'oneOff'
  const current = goal.status === 'active' || goal.status === 'paused'
  const next = current ? nextMilestone(milestones) : undefined
  const { reached, total } = milestoneCount(goal, detail)

  const start: StartRow = { kind: 'start', when: shortDate(goal.startDate), ...(goal.baseline && { baseline: goal.baseline }) }
  const rows = milestones.map((milestone): MilestoneRow => {
    const isNext = milestone === next
    return {
      kind: 'milestone',
      milestoneId: milestone.id,
      measurableLine: milestone.measurableLine,
      when: weekLabel(goal.startDate, milestone.targetDate),
      status: milestone.status,
      ...(milestone.result && { result: milestone.result }),
      next: isNext,
      checkable: current && (oneOff ? milestone.status !== 'hit' : isNext),
    }
  })
  const goalIsNext = current && next === undefined
  const end: GoalEndRow = {
    kind: 'goal',
    measurableLine: goal.measurableLine,
    ...(goal.deadline && { when: weekLabel(goal.startDate, goal.deadline) }),
    status: goal.status === 'reached' ? 'hit' : 'upcoming',
    next: goalIsNext,
    checkable: goalIsNext,
  }

  return {
    heading: oneOff ? 'Steps' : 'Milestones',
    count: `${reached} of ${total} ${oneOff ? 'done' : 'hit'}`,
    rows: [start, ...rows, end],
  }
}

// Not yet stays next: nothing is passed over until it's hit.
function nextMilestone(milestones: Milestone[]): Milestone | undefined {
  return milestones.find((milestone) => milestone.status !== 'hit')
}

function targetSection({ goal, weeklyTarget }: GoalDetail): TargetSection | undefined {
  if (goal.type === 'quitting') return { kind: 'note', line: `Since ${shortDate(goal.startDate)}` }
  if (goal.type === 'oneOff') return goal.deadline ? { kind: 'note', line: `Deadline: ${shortDate(goal.deadline)}` } : undefined
  if (!weeklyTarget) return { kind: 'weekly', line: 'No weekly target yet', action: 'Set' }
  return { kind: 'weekly', line: `${weeklyTarget.amount} ${weeklyTarget.unit}`, action: 'Edit' }
}

function nextCheckIn({ goal, milestones }: GoalDetail): NextCheckIn {
  const next = nextMilestone(milestones)
  if (!next) {
    return { measurableLine: goal.measurableLine, when: goal.deadline ? shortDate(goal.deadline) : WHENEVER }
  }
  return {
    milestoneId: next.id,
    measurableLine: next.measurableLine,
    when: next.targetDate ? weekLabel(goal.startDate, next.targetDate) : WHENEVER,
  }
}

const WHENEVER = 'Whenever you choose'

// Leads with progress since the baseline: "You started at … Now: …".
function notYetCard({ goal, milestones }: GoalDetail): NotYetCard | undefined {
  const notYet = milestones.find((milestone) => milestone.status === 'notYet')
  if (!notYet) return undefined
  const parts = [
    goal.baseline && `You started at ${lowerFirst(goal.baseline)}.`,
    notYet.result && `Now: ${lowerFirst(notYet.result)}.`,
  ].filter(Boolean)
  return {
    milestoneId: notYet.id,
    measurableLine: notYet.measurableLine,
    ...(notYet.targetDate && { targetDate: notYet.targetDate }),
    ...(parts.length && { progress: parts.join(' ') }),
  }
}

function weekNumber(startDate: string, day: string): number {
  const weeks = daysBetween(mondayDay(startDate), mondayDay(day)) / 7
  return weeks + 1
}

function mondayDay(day: string): string {
  return toLocalDay(mondayOf(fromLocalDay(day)))
}

// Whole days from a to b. Rounded, so a daylight-saving change doesn't matter.
function daysBetween(a: string, b: string): number {
  return Math.round((fromLocalDay(b).getTime() - fromLocalDay(a).getTime()) / 86_400_000)
}

function plusDays(day: string, days: number): string {
  return toLocalDay(addDays(fromLocalDay(day), days))
}

function shortDate(day: string): string {
  return fromLocalDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "Nov 10", or "Sep 15, 2025" in another year. Takes a day or an instant.
function dayLabel(value: string, today: string): string {
  const date = value.length === 10 ? fromLocalDay(value) : new Date(value)
  const sameYear = date.getFullYear() === fromLocalDay(today).getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
