// How a task's state is read and changed. Everything else asks here instead of reading the
// task's fields, so a change to the task type touches this file, the client and the mock.
import { addDays, fromLocalDay, toLocalDay } from '../api/dates.ts'
import type { CheckOff, Task } from '../api/types.ts'

type State = Pick<Task, 'state'>

// Open, with no day: in a week's bank.
export function isInBank(task: Pick<Task, 'state' | 'plannedDay'>): boolean {
  return task.state === 'open' && task.plannedDay === null
}

export function isDone(task: State): boolean {
  return task.state === 'done'
}

// Open and on a day.
export function isPlanned(task: Pick<Task, 'state' | 'plannedDay'>): boolean {
  return task.state === 'open' && task.plannedDay !== null
}

// Open or done on a day (a given one, or any). A task in the bank is on none, and a
// set-aside task isn't shown, so the client never sends one.
export function isOnDay(task: Pick<Task, 'state' | 'plannedDay'>, day?: string): boolean {
  if (task.state !== 'open' && task.state !== 'done') return false
  return day === undefined ? task.plannedDay !== null : task.plannedDay === day
}

// Added by hand, unfinished, on a day from today on: it can be moved or removed (spec 082).
export function isSetItem(task: Task, today: string): boolean {
  return task.origin === 'byHand' && isPlanned(task) && task.plannedDay !== null && task.plannedDay >= today
}

// A fixed-day task on a day from today on moves only to another day of its week, from today
// on (spec 082). A past day's is #81's.
export function canMoveInWeek(task: Task, today: string): boolean {
  if (!task.fixedDay || !isPlanned(task) || task.week === null || task.plannedDay! < today) return false
  const monday = fromLocalDay(task.week)
  return Array.from({ length: 7 }, (_, offset) => toLocalDay(addDays(monday, offset))).some(
    (day) => day >= today && day !== task.plannedDay,
  )
}

// The week the task is in; none while it waits for a due week.
export function weekOf(task: Pick<Task, 'week'>): string | null {
  return task.week
}

// Put on a day by the person, so the planner never moves it.
export function placedOnDay(task: Task, day: string): Task {
  return { ...task, state: 'open', plannedDay: day, placedByHand: true }
}

// Back to the bank: the day is cleared.
export function inTheBank(task: Task): Task {
  return { ...task, plannedDay: null, placedByHand: false }
}

// One reading of the clock, so the moment and the day can't disagree.
export function checkOffAt(now: Date): CheckOff {
  return { completedAt: now.toISOString(), completedOn: toLocalDay(now) }
}

// No value logged is null, as the API stores it.
export function checkedOff(task: Task, { completedAt, completedOn, valueLogged }: CheckOff): Task {
  return { ...task, state: 'done', completedAt, completedOn, valueLogged: valueLogged ?? null }
}

export function uncheckedOff(task: Task): Task {
  return { ...task, state: 'open', completedAt: null, completedOn: null, valueLogged: null }
}
