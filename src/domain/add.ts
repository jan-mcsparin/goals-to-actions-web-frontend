// Rules for the Add sheet: what a new task sends, the line confirming it, how
// a goal's sentence splits, the Recurring tab's choices, and when a form is
// ready to save. Which week a new task goes in is the server's (ADR-008).
import { fromLocalDay, mondayOfDay } from '../api/dates.ts'
import type {
  Aspiration,
  Goal,
  GoalType,
  NewGoal,
  NewRecurringItem,
  NewTask,
  RecurringItem,
  RecurringItemEdit,
  Schedule,
  Task,
} from '../api/types.ts'
import { dayLabel, isWithinGoal, parsedTarget, type TargetDraft } from './goalDetail.ts'
import { ordinal, repeatText, weekdayName, type Weekday } from './recurring.ts'
import { isPlanned, weekOf } from './tasks'

// As the server placed it. One due beyond the open weeks waits with no week until its week opens.
export function taskConfirmation(task: Pick<Task, 'state' | 'plannedDay' | 'week'>, today: string): string {
  if (isPlanned(task)) return task.plannedDay === today ? 'Added to today.' : `Set for ${weekdayAndDate(task.plannedDay!, today)}.`
  const week = weekOf(task)
  if (week === null) return "Saved. It joins the week it's due."
  if (week !== null && week > mondayOfDay(today)) return `Saved for the week of ${dayLabel(week, today)}.`
  return "Added to this week's bank."
}

// "Sat, Dec 12", with the year when it isn't this year's.
export function weekdayAndDate(day: string, today: string): string {
  const date = fromLocalDay(day)
  const sameYear = date.getFullYear() === fromLocalDay(today).getFullYear()
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(!sameYear && { year: 'numeric' }),
  })
}

// A title, and on a day, the day.
export function taskReady(draft: Pick<TaskDraft, 'title' | 'placement' | 'day'>): boolean {
  if (draft.placement === 'onADay' && !draft.day) return false
  return draft.title.trim() !== ''
}

export type Placement = 'onToday' | 'inBank' | 'onADay'

// The Task form as typed. Empty strings are fields left blank. Day and atTime are On a day's;
// dueDate, timeKind and time the other two's. Each keeps what was typed when the choice changes.
export type TaskDraft = {
  title: string
  goalId: string
  dueDate: string
  timeKind: '' | 'by' | 'at'
  time: string
  placement: Placement
  day: string
  atTime: string
}

export function emptyTaskDraft(placement: Placement): TaskDraft {
  return { title: '', goalId: '', dueDate: '', timeKind: '', time: '', placement, day: '', atTime: '' }
}

// Only what the chosen place shows is sent. On a day sends its day and an "at" time; the day is
// the constraint, so no due date. A time of day needs both "by" or "at" and a time; half of one
// is left out. "On today" sends today as its day; the bank sends none.
export function taskInput(draft: TaskDraft, today: string): NewTask {
  const input: NewTask = { title: draft.title }
  if (draft.goalId) input.goalId = draft.goalId
  if (draft.placement === 'onADay') {
    input.day = draft.day
    if (draft.atTime) input.timeOfDay = { kind: 'at', time: draft.atTime }
    return input
  }
  if (draft.placement === 'onToday') input.day = today
  if (draft.dueDate) input.dueDate = draft.dueDate
  if (draft.timeKind && draft.time) input.timeOfDay = { kind: draft.timeKind, time: draft.time }
  return input
}

export type Choice = { id: string; label: string }

// What the goal picker offers: active goals, by label.
export function goalChoices(goals: Goal[]): Choice[] {
  return goals
    .filter((goal) => goal.status === 'active')
    .map(({ id, label }) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// "Be strong: bench 175, squat 350" → the label before the first colon and the
// measurable line after it. With no colon, the whole sentence is the label.
export function splitGoalSentence(sentence: string): { label: string; measurableLine: string } {
  const [label, ...rest] = sentence.split(':')
  return { label: label.trim(), measurableLine: rest.join(':').trim() }
}

// What the aspiration picker offers: active aspirations, in priority order.
export function aspirationChoices(aspirations: Aspiration[]): Choice[] {
  return aspirations
    .filter((aspiration) => aspiration.status === 'active')
    .sort((a, b) => a.position! - b.position!)
    .map(({ id, name }) => ({ id, label: name }))
}

// The picker's choice for creating an aspiration along with the goal.
export const NEW_ASPIRATION = 'new'

export type GoalDraft = {
  type?: GoalType
  sentence: string
  // The second field, shown and used only when the sentence has no colon.
  measurableLine: string
  // '' for none, an aspiration's id, or NEW_ASPIRATION.
  aspirationId: string
  newAspirationName: string
  baseline: string
  target: TargetDraft // building only
  startDate: string // quitting only; '' means today
  deadline: string
}

export function emptyGoalDraft(): GoalDraft {
  return {
    type: undefined,
    sentence: '',
    measurableLine: '',
    aspirationId: '',
    newAspirationName: '',
    baseline: '',
    target: { sessions: '', unit: '' },
    startDate: '',
    deadline: '',
  }
}

// With no colon, the line is asked for in a field of its own.
export function needsLineField(sentence: string): boolean {
  return !sentence.includes(':')
}

// The label and line as they'll be saved, from the sentence or the second field.
export function goalParts(draft: Pick<GoalDraft, 'sentence' | 'measurableLine'>): { label: string; measurableLine: string } {
  const split = splitGoalSentence(draft.sentence)
  if (!needsLineField(draft.sentence)) return split
  return { label: split.label, measurableLine: draft.measurableLine.trim() }
}

// A type, a label and a line. A weekly target is optional, but one that's
// started must be whole. A deadline can't come before the start.
export function goalReady(draft: GoalDraft, today: string): boolean {
  if (!draft.type) return false
  const { label, measurableLine } = goalParts(draft)
  if (!label || !measurableLine) return false
  if (draft.aspirationId === NEW_ASPIRATION && !draft.newAspirationName.trim()) return false
  if (draft.type === 'building' && !targetBlankOrWhole(draft.target)) return false
  const startDate = (draft.type === 'quitting' && draft.startDate) || today
  return !draft.deadline || isWithinGoal(draft.deadline, { startDate })
}

// What the Add sheet sends to createGoal: only what the goal's type shows. A new
// aspiration is left out; useAdd saves it first and sends its id.
export function goalInput(draft: GoalDraft & { type: GoalType }, today: string): NewGoal {
  const input: NewGoal = { ...goalParts(draft), type: draft.type }
  if (draft.aspirationId && draft.aspirationId !== NEW_ASPIRATION) input.aspirationId = draft.aspirationId
  if (draft.baseline.trim()) input.baseline = draft.baseline.trim()
  if (draft.type === 'quitting') input.startDate = draft.startDate || today
  if (draft.deadline) input.deadline = draft.deadline
  const target = draft.type === 'building' ? parsedTarget(draft.target) : undefined
  if (target) input.weeklyTarget = target
  return input
}

// Shown over the new goal's page, where milestones (steps, for one-off) are added.
export function goalConfirmation(type: GoalType): string {
  return `Saved. Add ${type === 'oneOff' ? 'steps' : 'milestones'} when you're ready.`
}

function targetBlankOrWhole(target: TargetDraft): boolean {
  const blank = !target.sessions.trim() && !target.unit.trim()
  return blank || parsedTarget(target) !== undefined
}

export type AspirationDraft = { name: string; why: string }

export function aspirationReady(draft: AspirationDraft): boolean {
  return draft.name.trim() !== ''
}

// The Recurring tab's pickers. Each option's value names a schedule
// ("weekly:tuesday", "monthly:1", "flexible:3:week"), read back by
// scheduleOf.
export type RepeatOption = { value: string; label: string }

function optionValue(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'weekly':
      return `weekly:${schedule.weekday}`
    case 'monthly':
      return `monthly:${schedule.dayOfMonth}`
    case 'flexible':
      return `flexible:${schedule.times}:${schedule.period}`
  }
}

// Weeks start Monday, so Sunday comes last.
const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const WEEKLY_SCHEDULES: Schedule[] = WEEKDAYS.map((weekday) => ({ kind: 'weekly', weekday }))

// Up to the 28th, so every month has the day.
const MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1)

const MONTHLY_SCHEDULES: Schedule[] = MONTH_DAYS.map((dayOfMonth) => ({ kind: 'monthly', dayOfMonth }))

const FLEXIBLE_SCHEDULES: Schedule[] = [
  ...[1, 2, 3, 4, 5, 6].map((times) => ({ kind: 'flexible', times, period: 'week' }) as const),
  { kind: 'flexible', times: 1, period: 'twoWeeks' },
  { kind: 'flexible', times: 1, period: 'month' },
]

// Labelled by the day alone, under "Every week on".
export const WEEKDAY_OPTIONS: RepeatOption[] = WEEKDAYS.map((weekday) => ({
  value: optionValue({ kind: 'weekly', weekday }),
  label: weekdayName(weekday),
}))

// Labelled "1st" to "28th", under "Every month on the".
export const MONTH_DAY_OPTIONS: RepeatOption[] = MONTH_DAYS.map((dayOfMonth) => ({
  value: optionValue({ kind: 'monthly', dayOfMonth }),
  label: ordinal(dayOfMonth),
}))

// Labelled as the schedule reads: "3 times a week".
export const FLEXIBLE_OPTIONS: RepeatOption[] = FLEXIBLE_SCHEDULES.map((schedule) => ({
  value: optionValue(schedule),
  label: repeatText(schedule),
}))

const SCHEDULES_BY_VALUE = new Map(
  [...WEEKLY_SCHEDULES, ...MONTHLY_SCHEDULES, ...FLEXIBLE_SCHEDULES].map((schedule) => [optionValue(schedule), schedule]),
)

// An option's value back as the schedule it stands for.
export function scheduleOf(value: string): Schedule {
  const schedule = SCHEDULES_BY_VALUE.get(value)
  if (!schedule) throw new Error(`Unknown repeat: ${value}`)
  return { ...schedule }
}

export function recurringReady(draft: { name: string }): boolean {
  return draft.name.trim() !== ''
}

// Both pickers keep their choice, so switching between Fixed day and Flexible
// loses nothing. An empty aspirationId means Keep life running.
export type RecurringDraft = { name: string; fixedDay: boolean; fixed: string; flexible: string; aspirationId: string }

export function emptyRecurringDraft(aspirationId = ''): RecurringDraft {
  return { name: '', fixedDay: true, fixed: WEEKDAY_OPTIONS[0].value, flexible: FLEXIBLE_OPTIONS[0].value, aspirationId }
}

// It can be due from today: the plan places it on its first day from here.
export function recurringInput(draft: RecurringDraft, today: string): NewRecurringItem {
  return {
    name: draft.name.trim(),
    aspirationId: draft.aspirationId || null,
    schedule: scheduleOf(draft.fixedDay ? draft.fixed : draft.flexible),
    startsOn: today,
  }
}

// An item as the form shows it, to edit. The picker it doesn't use keeps its default, so
// switching between Fixed day and Flexible starts somewhere.
export function recurringDraftOf(item: RecurringItem): RecurringDraft {
  const empty = emptyRecurringDraft(item.aspirationId ?? '')
  const fixedDay = item.schedule.kind !== 'flexible'
  const value = optionValue(item.schedule)
  return {
    ...empty,
    name: item.name,
    fixedDay,
    ...(fixedDay ? { fixed: value } : { flexible: value }),
  }
}

// Sent whole. The start stays as the item has it: the API doesn't need a new one when the
// day changes. The goal it came from isn't part of an edit.
export function recurringEditInput(draft: RecurringDraft, item: Pick<RecurringItem, 'startsOn'>): RecurringItemEdit {
  const { name, aspirationId, schedule } = recurringInput(draft, item.startsOn)
  return { name, aspirationId, schedule, startsOn: item.startsOn }
}

// Named, and different from the item in its name, repeat or aspiration.
export function recurringEditReady(draft: RecurringDraft, item: RecurringItem): boolean {
  if (!recurringReady(draft)) return false
  const edit = recurringEditInput(draft, item)
  return (
    edit.name !== item.name ||
    edit.aspirationId !== item.aspirationId ||
    optionValue(edit.schedule) !== optionValue(item.schedule)
  )
}

export const RECURRING_CONFIRMATION = "Added. It will show up in the plan when it's next due."
