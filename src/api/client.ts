// The functions screens and hooks call. They read the in-memory mock store for
// now; later they call the real API and keep the same signatures.
import { mondayOf, toLocalDay } from './dates.ts'
import { store } from './mockStore.ts'
import type { Bank, Task, TodayPlan } from './types.ts'

export async function getToday(): Promise<TodayPlan> {
  const date = toLocalDay(new Date())
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

export async function getBank(): Promise<Bank> {
  const weekOf = toLocalDay(mondayOf(new Date()))
  const tasks = store.tasks.filter((task) => task.status === 'inBank' && task.weekOf === weekOf)
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks) })
}

// Skipping sends a task back to the bank. It isn't a rollover, so the count stays.
export async function skipTask(taskId: string): Promise<Task> {
  const task = findPlannedTask(taskId)
  moveToBank(task)
  return structuredClone(task)
}

export async function pullFromBank(bankTaskId: string): Promise<Task> {
  const task = findBankTask(bankTaskId)
  planForToday(task)
  return structuredClone(task)
}

// Both tasks are checked before either changes, so a bad ID changes nothing.
export async function swapTask(taskId: string, bankTaskId: string): Promise<{ skipped: Task; placed: Task }> {
  const skipped = findPlannedTask(taskId)
  const placed = findBankTask(bankTaskId)
  moveToBank(skipped)
  planForToday(placed)
  return structuredClone({ skipped, placed })
}

function moveToBank(task: Task) {
  task.status = 'inBank'
  delete task.plannedDay
}

function planForToday(task: Task) {
  task.status = 'planned'
  task.plannedDay = toLocalDay(new Date())
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

function findTask(taskId: string): Task {
  const task = store.tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new Error(`No task with id ${taskId}`)
  return task
}

function recordsReferencedBy(tasks: Task[]) {
  const goals = store.goals.filter((goal) => tasks.some((task) => task.goalId === goal.id))
  const recurringItems = store.recurringItems.filter((item) =>
    tasks.some((task) => task.recurringItemId === item.id),
  )
  const aspirationIds = new Set(
    [...goals, ...recurringItems].flatMap((record) => record.aspirationId ?? []),
  )
  const aspirations = store.aspirations.filter((aspiration) => aspirationIds.has(aspiration.id))
  return { goals, recurringItems, aspirations }
}
