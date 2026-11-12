// Rules for the Add sheet: where a new task goes, the line confirming it, how
// a goal's sentence splits, how a repeat reads and when it's next due, and
// when a form is ready to save.
import { addDays, fromLocalDay, mondayOfDay, toLocalDay } from '../api/dates.ts'
import type { Aspiration, Goal, GoalType, NewGoal, NewTask, Task } from '../api/types.ts'
import { dayLabel, isWithinGoal, parsedTarget, type TargetDraft } from './goalDetail.ts'

// This week's Monday, or the Monday of the due date's week when that's later.
export function taskWeek(dueDate: string | undefined, today: string): string {
  const thisWeek = mondayOfDay(today)
  if (!dueDate) return thisWeek
  const dueWeek = mondayOfDay(dueDate)
  return dueWeek > thisWeek ? dueWeek : thisWeek
}

export function taskConfirmation(task: Pick<Task, 'status' | 'weekOf'>, today: string): string {
  if (task.status === 'planned') return 'Added to today.'
  if (task.weekOf > mondayOfDay(today)) return `Saved for the week of ${dayLabel(task.weekOf, today)}.`
  return "Added to this week's bank."
}

export function taskReady(draft: { title: string }): boolean {
  return draft.title.trim() !== ''
}

export type Placement = 'inBank' | 'onToday'

// The Task form as typed. Empty strings are fields left blank.
export type TaskDraft = {
  title: string
  goalId: string
  dueDate: string
  timeKind: '' | 'by' | 'at'
  time: string
  placement: Placement
}

export function emptyTaskDraft(placement: Placement): TaskDraft {
  return { title: '', goalId: '', dueDate: '', timeKind: '', time: '', placement }
}

// A time of day needs both "by" or "at" and a time; half of one is left out.
export function taskInput(draft: TaskDraft): NewTask {
  const input: NewTask = { title: draft.title, onToday: draft.placement === 'onToday' }
  if (draft.goalId) input.goalId = draft.goalId
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
    .sort((a, b) => a.priority! - b.priority!)
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
    target: { amount: '', unit: '' },
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

// What the Add sheet sends to addGoal: only what the goal's type shows. A new
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
  const blank = !target.amount.trim() && !target.unit.trim()
  return blank || parsedTarget(target) !== undefined
}

export type AspirationDraft = { name: string; why: string }

export function aspirationReady(draft: AspirationDraft): boolean {
  return draft.name.trim() !== ''
}

// How often a recurring item comes round. Fixed: a weekday (0 is Sunday, as
// Date.getDay) or a day of the month, 1–28 so every month has it. Flexible:
// 1–6 times a week, every two weeks, or once a month.
export type RepeatChoice =
  | { kind: 'weekday'; weekday: number }
  | { kind: 'monthDay'; day: number }
  | { kind: 'timesAWeek'; times: number }
  | { kind: 'everyTwoWeeks' }
  | { kind: 'onceAMonth' }

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// As the mock reads: "Every Tuesday", "Monthly on the 1st", "3 times a week".
export function repeatRuleText(choice: RepeatChoice): string {
  switch (choice.kind) {
    case 'weekday':
      return `Every ${WEEKDAY_NAMES[choice.weekday]}`
    case 'monthDay':
      return `Monthly on the ${ordinal(choice.day)}`
    case 'timesAWeek':
      return choice.times === 1 ? 'Once a week' : `${choice.times} times a week`
    case 'everyTwoWeeks':
      return 'Every two weeks'
    case 'onceAMonth':
      return 'Once a month'
  }
}

export function isFixedDay(choice: RepeatChoice): boolean {
  return choice.kind === 'weekday' || choice.kind === 'monthDay'
}

// The first day on or after today that the item falls on. A flexible item
// can be done any day, so it's due today.
export function nextDue(choice: RepeatChoice, today: string): string {
  const date = fromLocalDay(today)
  if (choice.kind === 'weekday') {
    return toLocalDay(addDays(date, (choice.weekday - date.getDay() + 7) % 7))
  }
  if (choice.kind === 'monthDay') {
    const monthsAhead = choice.day < date.getDate() ? 1 : 0
    return toLocalDay(new Date(date.getFullYear(), date.getMonth() + monthsAhead, choice.day))
  }
  return today
}

function ordinal(day: number): string {
  const teens = day % 100 >= 11 && day % 100 <= 13
  const suffix = teens ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th')
  return `${day}${suffix}`
}

export function recurringReady(draft: { name: string }): boolean {
  return draft.name.trim() !== ''
}
