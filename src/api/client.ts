// The functions screens and hooks call. They read the in-memory mock store for
// now; later they call the real API and keep the same signatures.
import { addDays, fromLocalDay, mondayOf, toLocalDay } from './dates.ts'
import { store } from './mockStore.ts'
import type { AspirationsOverview, Bank, DayPlan, Task, Upkeep, WeekPlan, WeeklyTarget } from './types.ts'

export async function getDay(date: string): Promise<DayPlan> {
  const tasks = store.tasks.filter((task) => task.plannedDay === date)
  return structuredClone({ date, tasks, ...recordsReferencedBy(tasks) })
}

export async function checkOffTask(taskId: string, valueLogged?: number): Promise<Task> {
  const task = findTask(taskId)
  task.status = 'done'
  task.completedAt = new Date().toISOString()
  if (valueLogged !== undefined) task.valueLogged = valueLogged
  return structuredClone(task)
}

export async function uncheckTask(taskId: string): Promise<Task> {
  const task = findTask(taskId)
  if (task.status !== 'done') throw new Error(`Task ${taskId} is not done`)

  task.status = 'planned'
  delete task.completedAt
  delete task.valueLogged
  return structuredClone(task)
}

export async function getWeek(): Promise<WeekPlan> {
  const weekOf = thisWeek()
  const tasks = store.tasks.filter((task) => task.weekOf === weekOf)
  const weeklyTargets = targetsInForce(weekOf)
  const targetGoalIds = weeklyTargets.map((target) => target.goalId)
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks, targetGoalIds), weeklyTargets })
}

export async function getAspirations(): Promise<AspirationsOverview> {
  const weekOf = thisWeek()
  return structuredClone({
    aspirations: store.aspirations,
    goals: store.goals,
    milestones: store.milestones,
    recurringItems: store.recurringItems.filter((item) => item.active),
    weeklyTargets: targetsInForce(weekOf),
    weekTasks: store.tasks.filter((task) => task.weekOf === weekOf && task.goalId !== undefined),
  })
}

export async function getUpkeep(): Promise<Upkeep> {
  const weekOf = thisWeek()
  return structuredClone({
    recurringItems: store.recurringItems.filter((item) => item.active && item.aspirationId === undefined),
    tasks: store.tasks.filter((task) => isLoose(task) && isWaiting(task) && task.weekOf >= weekOf),
  })
}

export async function getBank(): Promise<Bank> {
  const weekOf = thisWeek()
  const tasks = store.tasks.filter((task) => task.status === 'inBank' && task.weekOf === weekOf)
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks) })
}

// Skipping sends a task back to the bank. It isn't a rollover, so the count stays.
export async function skipTask(taskId: string): Promise<Task> {
  const task = findPlannedTask(taskId)
  moveToBank(task)
  return structuredClone(task)
}

export async function pullFromBank(bankTaskId: string, day = toLocalDay(new Date())): Promise<Task> {
  if (day < toLocalDay(new Date())) throw new Error("Can't place a task on a past day")
  const task = findBankTask(bankTaskId)
  placeOn(task, day)
  return structuredClone(task)
}

// Both tasks are checked before either changes, so a bad ID changes nothing.
// The bank task goes onto the swapped task's day.
export async function swapTask(taskId: string, bankTaskId: string): Promise<{ skipped: Task; placed: Task }> {
  const skipped = findPlannedTask(taskId)
  const placed = findBankTask(bankTaskId)
  const day = skipped.plannedDay!
  moveToBank(skipped)
  placeOn(placed, day)
  return structuredClone({ skipped, placed })
}

function moveToBank(task: Task) {
  task.status = 'inBank'
  delete task.plannedDay
  delete task.placedByHand
}

function placeOn(task: Task, day: string) {
  task.status = 'planned'
  task.plannedDay = day
  task.placedByHand = true
}

function findPlannedTask(taskId: string): Task {
  const task = findTask(taskId)
  if (task.status !== 'planned') throw new Error(`Task ${taskId} is not planned`)
  return task
}

function findBankTask(taskId: string): Task {
  const task = findTask(taskId)
  if (task.status !== 'inBank') throw new Error(`Task ${taskId} is not in the bank`)
  return task
}

function isLoose(task: Task): boolean {
  return task.goalId === undefined && task.recurringItemId === undefined
}

// On a day or in the bank: not done, and not set aside.
function isWaiting(task: Task): boolean {
  return task.status === 'planned' || task.status === 'inBank'
}

function thisWeek(): string {
  return toLocalDay(mondayOf(new Date()))
}

// Each active goal's target for the week starting on weekOf, if it has one.
function targetsInForce(weekOf: string): WeeklyTarget[] {
  const sunday = toLocalDay(addDays(fromLocalDay(weekOf), 6))
  return store.goals
    .filter((goal) => goal.status === 'active')
    .flatMap((goal) => currentTarget(goal.id, sunday) ?? [])
}

// A target change adds a row; the one in force is the latest that has started.
function currentTarget(goalId: string, onOrBefore: string): WeeklyTarget | undefined {
  return store.weeklyTargets
    .filter((target) => target.goalId === goalId && target.effectiveFrom <= onOrBefore)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}

function findTask(taskId: string): Task {
  const task = store.tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new Error(`No task with id ${taskId}`)
  return task
}

// The goals, recurring items and aspirations behind these tasks, plus any
// extra goals asked for (a goal with a weekly target but no tasks yet).
function recordsReferencedBy(tasks: Task[], extraGoalIds: string[] = []) {
  const goalIds = new Set([...tasks.flatMap((task) => task.goalId ?? []), ...extraGoalIds])
  const goals = store.goals.filter((goal) => goalIds.has(goal.id))
  const recurringItems = store.recurringItems.filter((item) =>
    tasks.some((task) => task.recurringItemId === item.id),
  )
  const aspirationIds = new Set(
    [...goals, ...recurringItems].flatMap((record) => record.aspirationId ?? []),
  )
  const aspirations = store.aspirations.filter((aspiration) => aspirationIds.has(aspiration.id))
  return { goals, recurringItems, aspirations }
}
