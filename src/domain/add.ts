// Rules for the Add sheet: where a new task goes, the line confirming it, and
// when a form is ready to save.
import { mondayOfDay } from '../api/dates.ts'
import type { Goal, NewTask, Task } from '../api/types.ts'
import { dayLabel } from './goalDetail.ts'

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
