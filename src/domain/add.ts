// Rules for the Add sheet: where a new task goes, the line confirming it, how
// a goal's sentence splits, and when a form is ready to save.
import { mondayOfDay } from '../api/dates.ts'
import type { Goal, GoalType, NewTask, Task } from '../api/types.ts'
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

export type GoalChoice = { id: string; label: string }

// What the goal picker offers: active goals, by label.
export function goalChoices(goals: Goal[]): GoalChoice[] {
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

function targetBlankOrWhole(target: TargetDraft): boolean {
  const blank = !target.amount.trim() && !target.unit.trim()
  return blank || parsedTarget(target) !== undefined
}

export type AspirationDraft = { name: string; why: string }

export function aspirationReady(draft: AspirationDraft): boolean {
  return draft.name.trim() !== ''
}
