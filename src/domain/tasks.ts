// How a task's state is read and changed. Everything else asks here instead of reading the
// task's fields, so a change to the task type touches this file, the client and the mock.
import type { Task } from '../api/types'

export function isInBank(task: Pick<Task, 'status'>): boolean {
  return task.status === 'inBank'
}

export function isDone(task: Pick<Task, 'status'>): boolean {
  return task.status === 'done'
}

// Open and on a day.
export function isPlanned(task: Pick<Task, 'status'>): boolean {
  return task.status === 'planned'
}

// Open or done on a day (a given one, or any). A task in the bank or set aside is on none.
export function isOnDay(task: Pick<Task, 'status' | 'plannedDay'>, day?: string): boolean {
  if (task.status !== 'planned' && task.status !== 'done') return false
  return day === undefined || task.plannedDay === day
}

// The week the task is in.
export function weekOf(task: Pick<Task, 'weekOf'>): string {
  return task.weekOf
}

// Put on a day by the person, so the planner never moves it.
export function placedOnDay(task: Task, day: string): Task {
  return { ...task, status: 'planned', plannedDay: day, placedByHand: true }
}

export function checkedOff(task: Task, at: string): Task {
  return { ...task, status: 'done', completedAt: at }
}

export function uncheckedOff({ completedAt: _completedAt, valueLogged: _valueLogged, ...task }: Task): Task {
  return { ...task, status: 'planned' }
}
