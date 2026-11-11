// What one goal's page shows, worked out from a GoalDetail: the header, where
// it started, the timeline from Start to the goal itself, the weekly target,
// the next check-in and, while a milestone is not yet, the card that leads
// with progress. Also the push-out rule for moving a milestone's date.
// Nothing here paces or warns: a passed date reads like any other.
import { addDays, fromLocalDay, mondayOf, toLocalDay } from '../api/dates.ts'
import type { Aspiration, Goal, GoalDetail, GoalType, Milestone, MilestoneStatus } from '../api/types.ts'
import { milestoneCount } from './aspirations.ts'

export type Header = {
  goalId: string
  label: string
  measurableLine: string
  kindLine: string // "Building", or "Building · Paused"
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
  when: string // "Wk 9 · Nov 30"
  week: string // "Wk 9", for fold rows
  status: MilestoneStatus
  result?: string
  statusLine?: string // "Hit · Bench 150, …", "Not yet", or none while upcoming
  next: boolean
  checkable: boolean
}

// The final milestone: the goal's own measurable line. Not a Milestone record.
export type GoalEndRow = {
  kind: 'goal'
  measurableLine: string
  detail: string // "Goal", or "Goal · Wk 22 · Mar 1" with a deadline
  status: 'hit' | 'upcoming'
  statusLine?: 'Reached'
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

// The dates a milestone can have: from the goal's start to its deadline.
export type DateRange = { min: string; max?: string }

export type CurrentPage = PageBase & {
  kind: 'current'
  dateRange: DateRange
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
    dateRange: { min: goal.startDate, ...(goal.deadline && { max: goal.deadline }) },
    ...(target && { target }),
    nextCheckIn: nextCheckIn(detail),
    ...(notYet && { notYet }),
  }
}

// "Wk 9 · Nov 30": Monday-start weeks, the goal's first week is Wk 1.
export function weekLabel(startDate: string, targetDate: string | undefined): string {
  if (!targetDate) return 'No date'
  return `${weekOnly(startDate, targetDate)} · ${shortDate(targetDate)}`
}

// "Wk 9", or "No date".
function weekOnly(startDate: string, targetDate: string | undefined): string {
  return targetDate ? `Wk ${weekNumber(startDate, targetDate)}` : 'No date'
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

// What the target and add-milestone sheets hold: text as typed.
export type TargetDraft = { amount: string; unit: string }
export type MilestoneDraft = { measurableLine: string; targetDate: string } // '' for no date

export function targetDraft({ weeklyTarget }: GoalDetail): TargetDraft {
  return weeklyTarget ? { amount: String(weeklyTarget.amount), unit: weeklyTarget.unit } : { amount: '', unit: '' }
}

// A whole number of at least 1 and a unit, or nothing to save.
export function parsedTarget(draft: TargetDraft): { amount: number; unit: string } | undefined {
  const amount = draft.amount.trim()
  const unit = draft.unit.trim()
  if (!/^\d+$/.test(amount) || Number(amount) < 1 || !unit) return undefined
  return { amount: Number(amount), unit }
}

// The goal with its new target, from this week's Monday, as the API saves it.
export function withTarget(detail: GoalDetail, target: { amount: number; unit: string }, today: string): GoalDetail {
  const effectiveFrom = mondayDay(today)
  const existing = detail.weeklyTarget?.effectiveFrom === effectiveFrom ? detail.weeklyTarget : undefined
  return {
    ...detail,
    weeklyTarget: { id: existing?.id ?? 'pending', goalId: detail.goal.id, ...target, effectiveFrom },
  }
}

// A line and an optional date from the goal's start to its deadline, or
// nothing to save.
export function parsedMilestone(
  draft: MilestoneDraft,
  goal: Pick<Goal, 'startDate' | 'deadline'>,
): { measurableLine: string; targetDate?: string } | undefined {
  const measurableLine = draft.measurableLine.trim()
  const targetDate = draft.targetDate || undefined
  if (!measurableLine) return undefined
  if (targetDate && !isWithinGoal(targetDate, goal)) return undefined
  return { measurableLine, ...(targetDate && { targetDate }) }
}

// A milestone's date can't come before the goal started or after its deadline.
export function isWithinGoal(day: string, goal: Pick<Goal, 'startDate' | 'deadline'>): boolean {
  return day >= goal.startDate && (!goal.deadline || day <= goal.deadline)
}

export function withMilestone(detail: GoalDetail, milestone: Milestone): GoalDetail {
  return { ...detail, milestones: [...detail.milestones, milestone] }
}

// Where back goes, named only when sure: the tab, or the aspiration the goal
// was opened from while it's still the goal's own.
export function backLabel(
  from: { screen: 'aspirations' } | { screen: 'aspiration'; aspirationId: string },
  aspiration: Aspiration | undefined,
): string | undefined {
  if (from.screen === 'aspirations') return 'Aspirations'
  return aspiration?.id === from.aspirationId ? aspiration.name : undefined
}

// "Show all 6": the milestones and the goal.
export function showAllLabel(timeline: Timeline): string {
  return `Show all ${timeline.rows.filter((row) => row.kind !== 'start').length}`
}

// A run of timeline rows folded into one tappable row. Two folds can read the
// same, so each is keyed by the first row it hides.
export type FoldRow = {
  kind: 'fold'
  key: string
  label: string
  hidden: number
}

export type ShownRow = TimelineRow | FoldRow

// A stable key per shown row: a milestone's id, 'start', 'goal', or the fold's.
export function shownRowKey(row: ShownRow): string {
  if (row.kind === 'milestone') return row.milestoneId
  if (row.kind === 'fold') return row.key
  return row.kind
}

const MOST_SHOWN_IN_FULL = 4

// More than four milestones fold, so the target and Check in stay near the top.
export function canCondense(timeline: Timeline): boolean {
  return timeline.rows.filter((row) => row.kind === 'milestone').length > MOST_SHOWN_IN_FULL
}

// Keeps the latest hit milestone, every not-yet one, Next and the goal; each
// run of two or more rows between them folds. A run of one shows itself.
export function condenseTimeline(timeline: Timeline): ShownRow[] {
  const { rows } = timeline
  if (!canCondense(timeline)) return rows
  const steps = timeline.heading === 'Steps'
  const latestHit = rows.findLast((row) => row.kind === 'milestone' && row.status === 'hit')
  const kept = (row: TimelineRow) =>
    row.kind === 'goal' || row === latestHit || (row.kind === 'milestone' && (row.next || row.status === 'notYet'))

  const shown: ShownRow[] = []
  let run: TimelineRow[] = []
  const closeRun = () => {
    if (run.length === 1) shown.push(run[0])
    else if (run.length > 1) {
      shown.push({ kind: 'fold', key: `fold-${shownRowKey(run[0])}`, label: foldLabel(run, steps), hidden: run.length })
    }
    run = []
  }
  for (const row of rows) {
    if (!kept(row)) {
      run.push(row)
      continue
    }
    closeRun()
    shown.push(row)
  }
  closeRun()
  return shown
}

// "Start and 2 hit milestones", "2 more: Wk 16, No date".
function foldLabel(run: TimelineRow[], steps: boolean): string {
  const milestones = run.filter((row): row is MilestoneRow => row.kind === 'milestone')
  const count = milestones.length
  let rest: string
  if (!milestones.every((row) => row.status === 'hit')) {
    rest = `${count} more: ${milestones.map((row) => row.week).join(', ')}`
  } else if (steps) {
    rest = `${count} ${count === 1 ? 'step' : 'steps'} done`
  } else {
    rest = `${count} hit ${count === 1 ? 'milestone' : 'milestones'}`
  }
  return run[0].kind === 'start' ? `Start and ${rest}` : rest
}

function header({ goal, aspiration }: GoalDetail): Header {
  return {
    goalId: goal.id,
    label: goal.label,
    measurableLine: goal.measurableLine,
    kindLine: goal.status === 'paused' ? `${TYPE_LABELS[goal.type]} · Paused` : TYPE_LABELS[goal.type],
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
    const week = weekOnly(goal.startDate, milestone.targetDate)
    return {
      kind: 'milestone',
      milestoneId: milestone.id,
      measurableLine: milestone.measurableLine,
      when: milestone.targetDate ? `${week} · ${shortDate(milestone.targetDate)}` : week,
      week,
      status: milestone.status,
      ...(milestone.result && { result: milestone.result }),
      ...(milestone.status !== 'upcoming' && { statusLine: statusLine(milestone) }),
      next: isNext,
      checkable: current && (oneOff ? milestone.status !== 'hit' : isNext),
    }
  })
  const goalIsNext = current && next === undefined
  const end: GoalEndRow = {
    kind: 'goal',
    measurableLine: goal.measurableLine,
    detail: goal.deadline ? `Goal · ${weekLabel(goal.startDate, goal.deadline)}` : 'Goal',
    status: goal.status === 'reached' ? 'hit' : 'upcoming',
    ...(goal.status === 'reached' && { statusLine: 'Reached' as const }),
    next: goalIsNext,
    checkable: goalIsNext,
  }

  return {
    heading: oneOff ? 'Steps' : 'Milestones',
    count: `${reached} of ${total} ${oneOff ? 'done' : 'hit'}`,
    rows: [start, ...rows, end],
  }
}

// "Hit · Bench 150, squat 290", "Not yet · Bench 152", or the word alone.
function statusLine({ status, result }: Milestone): string {
  const label = status === 'hit' ? 'Hit' : 'Not yet'
  return result ? `${label} · ${result}` : label
}

// Not yet stays next: nothing is passed over until it's hit.
export function nextMilestone(milestones: Milestone[]): Milestone | undefined {
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

// "Nov 10", or "Sep 15, 2025" in another year.
function dayLabel(day: string, today: string): string {
  const date = fromLocalDay(day)
  const sameYear = date.getFullYear() === fromLocalDay(today).getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
