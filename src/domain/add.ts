// Rules for the Add sheet: where a new task goes, the line confirming it, and
// when a form is ready to save.
import { fromLocalDay, mondayOfDay } from '../api/dates.ts'
import type { Task } from '../api/types.ts'

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

// "Nov 23", or "Jan 4, 2027" in another year.
function dayLabel(day: string, today: string): string {
  const date = fromLocalDay(day)
  const sameYear = date.getFullYear() === fromLocalDay(today).getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}
