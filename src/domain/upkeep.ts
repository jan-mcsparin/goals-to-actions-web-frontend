// What the Keep life running page shows, worked out from an Upkeep: the
// recurring items under no aspiration, and the loose tasks still to do with
// where each one sits.
import { fromLocalDay, mondayOf, toLocalDay } from '../api/dates.ts'
import type { Task, Upkeep } from '../api/types.ts'

export type RecurringRow = {
  id: string
  name: string
  repeatRule: string
}

export type TodoRow = {
  taskId: string
  title: string
  where: string
  due?: string
}

export type UpkeepView = {
  recurring: RecurringRow[]
  todo: TodoRow[]
}

export function upkeepView(upkeep: Upkeep, today: string): UpkeepView {
  return {
    recurring: upkeep.recurringItems.map(({ id, name, repeatRule }) => ({ id, name, repeatRule })),
    todo: inPlanOrder(upkeep.tasks).map((task) => ({
      taskId: task.id,
      title: task.title,
      where: whereLabel(task, today),
      ...(task.dueDate && { due: `due ${shortDate(task.dueDate)}` }),
    })),
  }
}

// "Today", "Thursday", "In the bank", or "Week of Nov 23" for a later week.
export function whereLabel(task: Task, today: string): string {
  if (task.weekOf > toLocalDay(mondayOf(fromLocalDay(today)))) return `Week of ${shortDate(task.weekOf)}`
  if (task.plannedDay === undefined) return 'In the bank'
  if (task.plannedDay === today) return 'Today'
  return fromLocalDay(task.plannedDay).toLocaleDateString('en-US', { weekday: 'long' })
}

// By week; within a week, tasks on a day (in day order) come before the bank.
function inPlanOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.weekOf.localeCompare(b.weekOf) ||
      Number(a.plannedDay === undefined) - Number(b.plannedDay === undefined) ||
      (a.plannedDay ?? '').localeCompare(b.plannedDay ?? ''),
  )
}

function shortDate(day: string): string {
  return fromLocalDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
