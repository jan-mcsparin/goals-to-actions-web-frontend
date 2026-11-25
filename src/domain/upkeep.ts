// What the Keep life running page shows, worked out from an Upkeep: the
// recurring items under no aspiration (a paused one reads "Paused"), and the loose tasks still to do with
// where each one sits.
import { fromLocalDay, mondayOfDay } from '../api/dates.ts'
import type { Task, Upkeep } from '../api/types.ts'
import { repeatText } from './recurring.ts'
import { weekOf } from './tasks'

export type RecurringRow = {
  id: string
  name: string
  repeat: string
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
    recurring: upkeep.recurringItems.map(({ id, name, schedule, active }) => ({
      id,
      name,
      repeat: active ? repeatText(schedule) : 'Paused',
    })),
    todo: inPlanOrder(upkeep.tasks).map((task) => ({
      taskId: task.id,
      title: task.title,
      where: whereLabel(task, today),
      ...(task.dueDate && { due: `due ${shortDate(task.dueDate)}` }),
    })),
  }
}

// "Today", "Thursday", "In the bank", "Week of Nov 23" for a later week, or "Later" for one
// waiting for its week to open (the upcoming list).
export function whereLabel(task: Task, today: string): string {
  const week = weekOf(task)
  if (week === null) return 'Later'
  if (week !== null && week > mondayOfDay(today)) return `Week of ${shortDate(week)}`
  if (task.plannedDay === null) return 'In the bank'
  if (task.plannedDay === today) return 'Today'
  return fromLocalDay(task.plannedDay).toLocaleDateString('en-US', { weekday: 'long' })
}

// By week, those with no week yet last; within a week, tasks on a day (in day order) come
// before the bank.
function inPlanOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (weekOf(a) ?? NO_WEEK).localeCompare(weekOf(b) ?? NO_WEEK) ||
      Number(a.plannedDay === null) - Number(b.plannedDay === null) ||
      (a.plannedDay ?? '').localeCompare(b.plannedDay ?? ''),
  )
}

// Sorts after every real week.
const NO_WEEK = '9999-12-31'

function shortDate(day: string): string {
  return fromLocalDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
