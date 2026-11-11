// The functions screens and hooks call. They read the in-memory mock store for
// now; later they call the real API and keep the same signatures.
import { addDays, fromLocalDay, mondayOf, toLocalDay } from './dates.ts'
import { store } from './mockStore.ts'
import type {
  Aspiration,
  AspirationDetail,
  AspirationsOverview,
  Bank,
  DayPlan,
  Goal,
  GoalDetail,
  Milestone,
  RecurringItem,
  Task,
  Upkeep,
  WeekPlan,
  WeeklyTarget,
} from './types.ts'

// A record that isn't there (the API's 404), so a screen can tell it apart
// from a failed request.
export class NotFoundError extends Error {
  name = 'NotFoundError'
}

// Set-aside (skipped) tasks keep their day but don't show on it.
export async function getDay(date: string): Promise<DayPlan> {
  const tasks = store.tasks.filter((task) => task.plannedDay === date && task.status !== 'skipped')
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

export async function getAspiration(aspirationId: string): Promise<AspirationDetail> {
  const aspiration = findAspiration(aspirationId)
  const weekOf = thisWeek()
  const goals = store.goals.filter((goal) => goal.aspirationId === aspirationId)
  const goalIds = new Set(goals.map((goal) => goal.id))
  return structuredClone({
    aspiration,
    goals,
    milestones: store.milestones.filter((milestone) => goalIds.has(milestone.goalId)),
    recurringItems: store.recurringItems.filter((item) => item.aspirationId === aspirationId),
    weeklyTargets: targetsInForce(weekOf).filter((target) => goalIds.has(target.goalId)),
    weekTasks: store.tasks.filter((task) => task.weekOf === weekOf && task.goalId !== undefined && goalIds.has(task.goalId)),
    activeCount: activeAspirations().length,
  })
}

export async function getGoal(goalId: string): Promise<GoalDetail> {
  const goal = findGoal(goalId)
  return structuredClone({
    goal,
    aspiration: store.aspirations.find((aspiration) => aspiration.id === goal.aspirationId),
    milestones: store.milestones.filter((milestone) => milestone.goalId === goalId),
    weeklyTarget: currentTarget(goalId, sundayOf(thisWeek())),
  })
}

// Takes effect this week. A second change in the same week updates that
// week's row, so earlier weeks keep the target they had.
export async function setWeeklyTarget(goalId: string, amount: number, unit: string): Promise<WeeklyTarget> {
  const goal = findCurrentGoal(goalId)
  if (goal.type !== 'building') throw new Error(`${goalId} is not a building goal`)
  if (!Number.isInteger(amount) || amount < 1) throw new Error('A weekly target is a whole number, at least 1')
  const trimmedUnit = unit.trim()
  if (!trimmedUnit) throw new Error('A weekly target needs a unit')

  const weekOf = thisWeek()
  let target = store.weeklyTargets.find((row) => row.goalId === goalId && row.effectiveFrom === weekOf)
  if (!target) {
    target = { id: newId('wt'), goalId, amount, unit: trimmedUnit, effectiveFrom: weekOf }
    store.weeklyTargets.push(target)
  }
  target.amount = amount
  target.unit = trimmedUnit
  return structuredClone(target)
}

// Goes after the goal's last milestone, upcoming, never past the deadline.
export async function addMilestone(
  goalId: string,
  milestone: { measurableLine: string; targetDate?: string },
): Promise<Milestone> {
  const goal = findCurrentGoal(goalId)
  const measurableLine = milestone.measurableLine.trim()
  if (!measurableLine) throw new Error('A milestone needs a measurable line')
  const { targetDate } = milestone
  if (targetDate && goal.deadline && targetDate > goal.deadline) throw new Error("A milestone can't come after the deadline")

  const added: Milestone = { id: newId('ms'), goalId, measurableLine, status: 'upcoming' }
  if (targetDate) added.targetDate = targetDate
  store.milestones.push(added)
  return structuredClone(added)
}

// A blank why is removed; anything not given stays as it was.
export async function updateAspiration(
  aspirationId: string,
  changes: { name?: string; why?: string },
): Promise<Aspiration> {
  const aspiration = findAspiration(aspirationId)
  const name = changes.name?.trim()
  if (name === '') throw new Error('An aspiration needs a name')

  if (name !== undefined) aspiration.name = name
  if (changes.why !== undefined) {
    const why = changes.why.trim()
    if (why) aspiration.why = why
    else delete aspiration.why
  }
  return structuredClone(aspiration)
}

// Swaps priority with the active aspiration just above or below.
export async function moveAspiration(aspirationId: string, direction: 'up' | 'down'): Promise<Aspiration[]> {
  const aspiration = findActiveAspiration(aspirationId)
  const order = activeAspirations()
  const index = order.indexOf(aspiration)
  const neighbour = order[direction === 'up' ? index - 1 : index + 1]
  if (!neighbour) throw new Error(`${aspirationId} is already ${direction === 'up' ? 'first' : 'last'}`)

  const priority = aspiration.priority
  aspiration.priority = neighbour.priority
  neighbour.priority = priority
  return structuredClone(activeAspirations())
}

// 'pause': its active goals pause, its recurring items turn off, and their
// not-done tasks this week are set aside (skipped), keeping their day.
// 'keep': its active and paused goals and its recurring items carry on with
// no aspiration. Either way its reached and ended goals stay with it.
export async function retireAspiration(aspirationId: string, itsWork: 'pause' | 'keep'): Promise<Aspiration> {
  const aspiration = findActiveAspiration(aspirationId)
  const goals = store.goals.filter((goal) => goal.aspirationId === aspirationId && isCurrentGoal(goal))
  const items = store.recurringItems.filter((item) => item.aspirationId === aspirationId)

  if (itsWork === 'pause') pauseWork(goals, items)
  else for (const record of [...goals, ...items]) delete record.aspirationId

  aspiration.status = 'retired'
  aspiration.retiredAt = new Date().toISOString()
  delete aspiration.priority
  activeAspirations().forEach((active, index) => (active.priority = index + 1))
  return structuredClone(aspiration)
}

// Active again, last in priority. Goals and recurring items it paused stay paused.
export async function bringBackAspiration(aspirationId: string): Promise<Aspiration> {
  const aspiration = findAspiration(aspirationId)
  if (aspiration.status !== 'retired') throw new Error(`${aspirationId} is not retired`)

  aspiration.priority = activeAspirations().length + 1
  aspiration.status = 'active'
  delete aspiration.retiredAt
  return structuredClone(aspiration)
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
  const sunday = sundayOf(weekOf)
  return store.goals
    .filter((goal) => goal.status === 'active')
    .flatMap((goal) => currentTarget(goal.id, sunday) ?? [])
}

function sundayOf(weekOf: string): string {
  return toLocalDay(addDays(fromLocalDay(weekOf), 6))
}

// A target change adds a row; the one in force is the latest that has started.
function currentTarget(goalId: string, onOrBefore: string): WeeklyTarget | undefined {
  return store.weeklyTargets
    .filter((target) => target.goalId === goalId && target.effectiveFrom <= onOrBefore)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}

function findAspiration(aspirationId: string): Aspiration {
  const aspiration = store.aspirations.find((candidate) => candidate.id === aspirationId)
  if (!aspiration) throw new NotFoundError(`No aspiration with id ${aspirationId}`)
  return aspiration
}

function findGoal(goalId: string): Goal {
  const goal = store.goals.find((candidate) => candidate.id === goalId)
  if (!goal) throw new NotFoundError(`No goal with id ${goalId}`)
  return goal
}

// Active or paused: a reached or ended goal can't be changed.
function findCurrentGoal(goalId: string): Goal {
  const goal = findGoal(goalId)
  if (!isCurrentGoal(goal)) throw new Error(`${goalId} is ${goal.status}`)
  return goal
}

// The real API assigns ids; the mock makes its own.
function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function pauseWork(goals: Goal[], items: RecurringItem[]) {
  const pausing = goals.filter((goal) => goal.status === 'active')
  const goalIds = new Set(pausing.map((goal) => goal.id))
  const itemIds = new Set(items.map((item) => item.id))
  for (const goal of pausing) goal.status = 'paused'
  for (const item of items) item.active = false

  const weekOf = thisWeek()
  for (const task of store.tasks) {
    const belongs = goalIds.has(task.goalId ?? '') || itemIds.has(task.recurringItemId ?? '')
    if (belongs && task.weekOf === weekOf && isWaiting(task)) task.status = 'skipped'
  }
}

function isCurrentGoal(goal: Goal): boolean {
  return goal.status === 'active' || goal.status === 'paused'
}

function findActiveAspiration(aspirationId: string): Aspiration {
  const aspiration = findAspiration(aspirationId)
  if (aspiration.status !== 'active') throw new Error(`${aspirationId} is retired`)
  return aspiration
}

// In priority order. Only active aspirations have a priority.
function activeAspirations(): Aspiration[] {
  return store.aspirations
    .filter((aspiration) => aspiration.status === 'active')
    .sort((a, b) => a.priority! - b.priority!)
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
