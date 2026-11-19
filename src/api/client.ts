// The functions screens and hooks call. They read the in-memory mock store,
// except that with the switch on real (mode.ts) the aspiration ones call the
// API instead (realAspirations.ts), with the same signatures.
import { mondayOf, toLocalDay } from './dates.ts'
import { taskWeek } from '../domain/add.ts'
import { isWithinGoal, nextMilestone, pushedDates } from '../domain/goalDetail.ts'
import { isIntensity } from '../domain/settings.ts'
import { NotFoundError } from './errors.ts'
import { newDeviceId } from './ids.ts'
import type { StoredCheckIn, StoredGoal, StoredMilestone } from './mockData.ts'
import { store } from './mockStore.ts'
import { realApi } from './mode.ts'
import * as real from './realAspirations.ts'
import type {
  Aspiration,
  AspirationDetail,
  AspirationsOverview,
  Bank,
  DayPlan,
  Goal,
  GoalDetail,
  Intensity,
  ListedGoal,
  Milestone,
  NewAspiration,
  NewGoal,
  NewRecurringItem,
  NewTask,
  RecurringItem,
  Settings,
  Task,
  Upkeep,
  WeekPlan,
  WeeklyTarget,
  WeeklyTargetInput,
} from './types.ts'

export { NotFoundError }

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
  const targetGoalIds = store.goals
    .filter((goal) => goal.status === 'active' && latestTarget(goal.id))
    .map((goal) => goal.id)
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks, targetGoalIds) })
}

export async function getAspirations(): Promise<AspirationsOverview> {
  if (realApi) return real.getAspirations()
  const weekOf = thisWeek()
  return structuredClone({
    aspirations: store.aspirations,
    goals: store.goals.map(listedGoal),
    recurringItems: store.recurringItems.filter((item) => item.active),
    weekTasks: store.tasks.filter((task) => task.weekOf === weekOf && task.goalId !== undefined),
  })
}

export async function getAspiration(aspirationId: string): Promise<AspirationDetail> {
  if (realApi) return real.getAspiration(aspirationId)
  const aspiration = findAspiration(aspirationId)
  const weekOf = thisWeek()
  const goals = store.goals.filter((goal) => goal.aspirationId === aspirationId)
  const goalIds = new Set(goals.map((goal) => goal.id))
  return structuredClone({
    aspiration,
    goals: goals.map(listedGoal),
    recurringItems: store.recurringItems.filter((item) => item.aspirationId === aspirationId),
    weekTasks: store.tasks.filter((task) => task.weekOf === weekOf && task.goalId !== undefined && goalIds.has(task.goalId)),
    activeCount: activeAspirations().length,
  })
}

// As the API's page: positions and results worked out from the store.
export async function getGoal(goalId: string): Promise<GoalDetail> {
  const goal = findGoal(goalId)
  const aspiration = store.aspirations.find((candidate) => candidate.id === goal.aspirationId)
  return structuredClone({
    goal: goalOut(goal),
    aspiration: aspiration ? { id: aspiration.id, name: aspiration.name } : null,
    milestones: milestonesOf(goalId).map(milestoneOut),
    progress: progressOf(goal),
    latest: latestResult(goalId),
  })
}

// A count target, from this week. A second change in the same week updates
// that week's row, so earlier weeks keep the target they had.
export async function setWeeklyTarget(goalId: string, sessions: number, unit: string): Promise<WeeklyTarget> {
  const goal = findCurrentGoal(goalId)
  if (goal.type !== 'building') throw new Error(`${goalId} is not a building goal`)
  if (!Number.isInteger(sessions) || sessions < 1) throw new Error('A weekly target is a whole number, at least 1')
  const trimmedUnit = unit.trim()
  if (!trimmedUnit) throw new Error('A weekly target needs a unit')

  const weekOf = thisWeek()
  let row = store.weeklyTargets.find((candidate) => candidate.goalId === goalId && candidate.effectiveFrom === weekOf)
  if (!row) {
    row = { goalId, kind: 'count', sessions, amount: null, unit: trimmedUnit, effectiveFrom: weekOf }
    store.weeklyTargets.push(row)
  }
  row.sessions = sessions
  row.unit = trimmedUnit
  return structuredClone(latestTarget(goalId)!)
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
  if (targetDate && !isWithinGoal(targetDate, goal)) throw new Error("A milestone's date must fall between the goal's start and its deadline")

  const added: StoredMilestone = { id: newId('ms'), goalId, measurableLine, status: 'upcoming', targetDate: targetDate ?? null }
  store.milestones.push(added)
  return structuredClone(milestoneOut(added))
}

// Hit or not yet, kept as a check-in dated today with the result. A building
// or quitting goal's milestones are checked in in order, so only Next can be;
// a one-off goal's steps can be done in any order.
export async function checkInMilestone(
  milestoneId: string,
  outcome: 'hit' | 'notYet',
  result?: string,
): Promise<Milestone> {
  const milestone = findMilestone(milestoneId)
  const goal = findCurrentGoal(milestone.goalId)
  if (milestone.status === 'hit') throw new Error(`${milestoneId} is already hit`)
  if (goal.type !== 'oneOff' && nextMilestone(milestonesOf(goal.id)) !== milestone) {
    throw new Error(`${milestoneId} isn't next`)
  }

  milestone.status = outcome
  store.checkIns.push({
    id: newDeviceId(),
    goalId: goal.id,
    milestoneId,
    outcome,
    result: result?.trim() || null,
    checkedInOn: toLocalDay(new Date()),
  })
  return structuredClone(milestoneOut(milestone))
}

// A not-yet milestone back to upcoming: keep the date (no changes), move it,
// or adjust its line and date. A later date pushes the ones after it out.
// Returns the goal's milestones, since several can move. Its check-ins stay.
export async function reopenMilestone(
  milestoneId: string,
  changes: { measurableLine?: string; targetDate?: string } = {},
): Promise<Milestone[]> {
  const milestone = findMilestone(milestoneId)
  const goal = findCurrentGoal(milestone.goalId)
  if (milestone.status !== 'notYet') throw new Error(`${milestoneId} isn't marked not yet`)
  const measurableLine = changes.measurableLine?.trim()
  if (measurableLine === '') throw new Error('A milestone needs a measurable line')
  const { targetDate } = changes
  if (targetDate && !isWithinGoal(targetDate, goal)) {
    throw new Error("A milestone's date must fall between the goal's start and its deadline")
  }

  if (targetDate) {
    const moved = pushedDates(goal, milestonesOf(goal.id), milestoneId, targetDate)
    for (const row of moved) findMilestone(row.id).targetDate = row.targetDate
  }
  if (measurableLine) milestone.measurableLine = measurableLine
  milestone.status = 'upcoming'
  return structuredClone(milestonesOf(goal.id).map(milestoneOut))
}

// Its not-done tasks this week are set aside (skipped), keeping their day,
// as when an aspiration is retired with "Pause them".
export async function pauseGoal(goalId: string): Promise<Goal> {
  const goal = findGoal(goalId)
  if (goal.status !== 'active') throw new Error(`${goalId} is ${goal.status}`)
  pauseWork([goal], [])
  return structuredClone(goalOut(goal))
}

// Active again. From paused, its set-aside tasks this week go back to the
// bank; from ended (Go again) or reached (Reopen, after reaching it by
// mistake), the end date goes. Allowed under a retired aspiration: the goal
// keeps it.
export async function resumeGoal(goalId: string): Promise<Goal> {
  const goal = findGoal(goalId)
  if (goal.status === 'paused') {
    const weekOf = thisWeek()
    for (const task of store.tasks) {
      if (task.goalId === goalId && task.weekOf === weekOf && task.status === 'skipped') moveToBank(task)
    }
  } else if (goal.status === 'ended' || goal.status === 'reached') {
    goal.endedOn = null
  } else {
    throw new Error(`${goalId} is ${goal.status}`)
  }
  goal.status = 'active'
  return structuredClone(goalOut(goal))
}

// Reached or ended today. Its tasks stay as they are.
export async function endGoal(goalId: string, outcome: 'reached' | 'ended'): Promise<Goal> {
  const goal = findCurrentGoal(goalId)
  goal.status = outcome
  goal.endedOn = toLocalDay(new Date())
  return structuredClone(goalOut(goal))
}

// A blank why is null; anything not given stays as it was.
export async function updateAspiration(
  aspirationId: string,
  changes: { name?: string; why?: string },
): Promise<Aspiration> {
  if (realApi) return real.updateAspiration(aspirationId, changes)
  const aspiration = findAspiration(aspirationId)
  const name = changes.name?.trim()
  if (name === '') throw new Error('An aspiration needs a name')

  if (name !== undefined) aspiration.name = name
  if (changes.why !== undefined) {
    aspiration.why = changes.why.trim() || null
  }
  return structuredClone(aspiration)
}

// Swaps priority with the active aspiration just above or below.
export async function moveAspiration(aspirationId: string, direction: 'up' | 'down'): Promise<Aspiration[]> {
  if (realApi) return real.moveAspiration(aspirationId, direction)
  const aspiration = findActiveAspiration(aspirationId)
  const order = activeAspirations()
  const index = order.indexOf(aspiration)
  const neighbour = order[direction === 'up' ? index - 1 : index + 1]
  if (!neighbour) throw new Error(`${aspirationId} is already ${direction === 'up' ? 'first' : 'last'}`)

  const position = aspiration.position
  aspiration.position = neighbour.position
  neighbour.position = position
  return structuredClone(activeAspirations())
}

// 'pause': its active goals pause, its recurring items turn off, and their
// not-done tasks this week are set aside (skipped), keeping their day.
// 'keep': its active and paused goals and its recurring items carry on with
// no aspiration. Either way its reached and ended goals stay with it.
export async function retireAspiration(aspirationId: string, itsWork: 'pause' | 'keep'): Promise<Aspiration> {
  if (realApi) return real.retireAspiration(aspirationId, itsWork)
  const aspiration = findActiveAspiration(aspirationId)
  const goals = store.goals.filter((goal) => goal.aspirationId === aspirationId && isCurrentGoal(goal))
  const items = store.recurringItems.filter((item) => item.aspirationId === aspirationId)

  if (itsWork === 'pause') pauseWork(goals, items)
  else {
    for (const goal of goals) goal.aspirationId = null
    for (const item of items) delete item.aspirationId
  }

  aspiration.status = 'retired'
  aspiration.retiredOn = toLocalDay(new Date())
  aspiration.position = null
  activeAspirations().forEach((active, index) => (active.position = index + 1))
  return structuredClone(aspiration)
}

// Active again, last in priority. Goals and recurring items it paused stay paused.
export async function bringBackAspiration(aspirationId: string): Promise<Aspiration> {
  if (realApi) return real.bringBackAspiration(aspirationId)
  const aspiration = findAspiration(aspirationId)
  if (aspiration.status !== 'retired') throw new Error(`${aspirationId} is not retired`)

  aspiration.position = activeAspirations().length + 1
  aspiration.status = 'active'
  aspiration.retiredOn = null
  return structuredClone(aspiration)
}

export async function getUpkeep(): Promise<Upkeep> {
  const weekOf = thisWeek()
  return structuredClone({
    recurringItems: store.recurringItems.filter((item) => item.active && item.aspirationId === undefined),
    tasks: store.tasks.filter((task) => isLoose(task) && isWaiting(task) && task.weekOf >= weekOf),
  })
}

export async function getSettings(): Promise<Settings> {
  return structuredClone(store.settings)
}

// Set today, even when it's the intensity already set: the person chose it again.
export async function setIntensity(intensity: Intensity): Promise<Settings> {
  if (!isIntensity(intensity)) throw new Error(`Unknown intensity ${intensity}`)
  store.settings.intensity = intensity
  store.settings.intensitySetOn = toLocalDay(new Date())
  return structuredClone(store.settings)
}

export async function getBank(): Promise<Bank> {
  const weekOf = thisWeek()
  const tasks = store.tasks.filter((task) => task.status === 'inBank' && task.weekOf === weekOf)
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks) })
}

// In the bank of this week, or of its due week when that's later. With
// onToday it goes on today's plan, placed by hand, whatever its due date.
export async function addTask(task: NewTask): Promise<Task> {
  const title = task.title.trim()
  if (!title) throw new Error('A task needs a title')
  if (task.goalId) findActiveGoal(task.goalId)

  const today = toLocalDay(new Date())
  const added: Task = { id: newId('task'), title, status: 'inBank', weekOf: taskWeek(task.dueDate, today), rolloverCount: 0 }
  if (task.goalId) added.goalId = task.goalId
  if (task.dueDate) added.dueDate = task.dueDate
  if (task.timeOfDay) added.timeOfDay = { ...task.timeOfDay }
  if (task.onToday) {
    added.weekOf = thisWeek()
    placeOn(added, today)
  }
  store.tasks.push(added)
  return structuredClone(added)
}

// The planner's stand-in adds no more than one task a day, so a typo in a
// weekly target can't flood the bank.
const MOST_STAND_IN_TASKS = 7

// Everything is checked before anything is stored. A weekly target's tasks
// stand in for the planner, so the new goal can be followed into the week.
export async function addGoal(goal: NewGoal): Promise<Goal> {
  const label = goal.label.trim()
  const measurableLine = goal.measurableLine.trim()
  if (!label || !measurableLine) throw new Error('A goal needs a label and a measurable line')
  if (goal.aspirationId) findActiveAspiration(goal.aspirationId)
  const startDate = goal.startDate ?? toLocalDay(new Date())
  if (goal.deadline && !isWithinGoal(goal.deadline, { startDate })) throw new Error("A goal's deadline can't come before its start")
  const target = goal.weeklyTarget && checkedTarget(goal.type, goal.weeklyTarget)

  const added: StoredGoal = {
    id: newId('goal'),
    label,
    measurableLine,
    type: goal.type,
    status: 'active',
    startDate,
    aspirationId: goal.aspirationId ?? null,
    baseline: goal.baseline?.trim() || null,
    deadline: goal.deadline ?? null,
    endedOn: null,
    createdAt: new Date().toISOString(),
  }
  store.goals.push(added)
  if (target) {
    const weekOf = thisWeek()
    store.weeklyTargets.push({ goalId: added.id, ...target, effectiveFrom: weekOf })
    for (let count = 0; count < Math.min(target.sessions, MOST_STAND_IN_TASKS); count++) {
      store.tasks.push({ id: newId('task'), title: label, goalId: added.id, status: 'inBank', weekOf, rolloverCount: 0 })
    }
  }
  return structuredClone(goalOut(added))
}

// Last in priority; it can be moved up on its page. Its id is made here, on
// the device, as the real API expects.
export async function addAspiration(aspiration: NewAspiration): Promise<Aspiration> {
  if (realApi) return real.addAspiration(aspiration)
  const name = aspiration.name.trim()
  if (!name) throw new Error('An aspiration needs a name')

  const added: Aspiration = {
    id: newDeviceId(),
    name,
    why: aspiration.why?.trim() || null,
    position: activeAspirations().length + 1,
    status: 'active',
    createdAt: new Date().toISOString(),
    retiredOn: null,
  }
  store.aspirations.push(added)
  return structuredClone(added)
}

// Active from now. Without an aspiration it belongs to Keep life running.
// Its tasks are the planner's, so none are added here.
export async function addRecurringItem(item: NewRecurringItem): Promise<RecurringItem> {
  const name = item.name.trim()
  if (!name) throw new Error('A recurring item needs a name')
  if (item.aspirationId) findActiveAspiration(item.aspirationId)

  const added: RecurringItem = {
    id: newId('rec'),
    name,
    repeatRule: item.repeatRule,
    fixedDay: item.fixedDay,
    active: true,
    nextDue: item.nextDue,
  }
  if (item.aspirationId) added.aspirationId = item.aspirationId
  store.recurringItems.push(added)
  return structuredClone(added)
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

// A goal as the API sends it: with its latest target, and whether it has slipped.
function goalOut(goal: StoredGoal): Goal {
  const slipped = goal.status === 'active' && goal.deadline !== null && goal.deadline < toLocalDay(new Date())
  return { ...goal, slipped, weeklyTarget: latestTarget(goal.id) ?? null }
}

// As listGoals sends it: "2 of 6" is milestones hit plus the goal itself. A
// reached goal counts complete: milestones never checked in were passed on the way.
function listedGoal(goal: StoredGoal): ListedGoal {
  return { ...goalOut(goal), progress: progressOf(goal) }
}

function progressOf(goal: StoredGoal): ListedGoal['progress'] {
  const milestones = milestonesOf(goal.id)
  const of = milestones.length + 1
  const hit = goal.status === 'reached' ? of : milestones.filter((milestone) => milestone.status === 'hit').length
  return { hit, of }
}

// A target change adds a row, or updates this week's; the latest is the one shown.
function latestTarget(goalId: string): WeeklyTarget | undefined {
  const row = store.weeklyTargets
    .filter((target) => target.goalId === goalId)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  if (!row) return undefined
  const { goalId: _goalId, ...target } = row
  return target
}

function findAspiration(aspirationId: string): Aspiration {
  const aspiration = store.aspirations.find((candidate) => candidate.id === aspirationId)
  if (!aspiration) throw new NotFoundError(`No aspiration with id ${aspirationId}`)
  return aspiration
}

function findGoal(goalId: string): StoredGoal {
  const goal = store.goals.find((candidate) => candidate.id === goalId)
  if (!goal) throw new NotFoundError(`No goal with id ${goalId}`)
  return goal
}

function findMilestone(milestoneId: string): StoredMilestone {
  const milestone = store.milestones.find((candidate) => candidate.id === milestoneId)
  if (!milestone) throw new NotFoundError(`No milestone with id ${milestoneId}`)
  return milestone
}

// New work can only go to an active goal, as the Add sheet's picker offers.
function findActiveGoal(goalId: string): StoredGoal {
  const goal = findGoal(goalId)
  if (goal.status !== 'active') throw new Error(`${goalId} is ${goal.status}`)
  return goal
}

// In the goal's order.
function milestonesOf(goalId: string): StoredMilestone[] {
  return store.milestones.filter((milestone) => milestone.goalId === goalId)
}

// As the API sends one: numbered in the goal's order, with its latest
// check-in's result while it's hit or not yet.
function milestoneOut(milestone: StoredMilestone): Milestone {
  const { goalId, ...fields } = milestone
  const position = milestonesOf(goalId).indexOf(milestone) + 1
  if (milestone.status === 'upcoming') return { ...fields, position, result: null }
  const own = store.checkIns.filter((checkIn) => checkIn.milestoneId === milestone.id)
  const latest = own.findLast((checkIn) => checkIn.outcome === 'hit') ?? newest(own)
  return { ...fields, position, result: latest?.result ?? null }
}

// "Latest" on the goal's page: its newest check-in with a result.
function latestResult(goalId: string): GoalDetail['latest'] {
  const latest = newest(store.checkIns.filter((checkIn) => checkIn.goalId === goalId && checkIn.result))
  return latest ? { result: latest.result!, checkedInOn: latest.checkedInOn } : null
}

// The latest day; on the same day, the one kept last.
function newest(checkIns: StoredCheckIn[]): StoredCheckIn | undefined {
  return checkIns.reduce<StoredCheckIn | undefined>(
    (latest, checkIn) => (!latest || checkIn.checkedInOn >= latest.checkedInOn ? checkIn : latest),
    undefined,
  )
}

// The rule setWeeklyTarget enforces, for a new goal.
function checkedTarget(type: Goal['type'], target: WeeklyTargetInput): Omit<WeeklyTarget, 'effectiveFrom'> {
  if (type !== 'building') throw new Error('Only a building goal has a weekly target')
  const unit = target.unit.trim()
  if (!Number.isInteger(target.sessions) || target.sessions < 1) throw new Error('A weekly target is a whole number, at least 1')
  if (!unit) throw new Error('A weekly target needs a unit')
  return { kind: target.kind, sessions: target.sessions, amount: target.amount ?? null, unit }
}

// Active or paused: a reached or ended goal can't be changed.
function findCurrentGoal(goalId: string): StoredGoal {
  const goal = findGoal(goalId)
  if (!isCurrentGoal(goal)) throw new Error(`${goalId} is ${goal.status}`)
  return goal
}

// Ids for the records whose screens aren't on the API yet; #39 moves them to
// newDeviceId. A counter: the store resets on reload, and so does this.
let lastId = 0

function newId(prefix: string): string {
  return `${prefix}-new-${++lastId}`
}

function pauseWork(goals: StoredGoal[], items: RecurringItem[]) {
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

function isCurrentGoal(goal: StoredGoal): boolean {
  return goal.status === 'active' || goal.status === 'paused'
}

function findActiveAspiration(aspirationId: string): Aspiration {
  const aspiration = findAspiration(aspirationId)
  if (aspiration.status !== 'active') throw new Error(`${aspirationId} is retired`)
  return aspiration
}

// In priority order. Only active aspirations have a position.
function activeAspirations(): Aspiration[] {
  return store.aspirations
    .filter((aspiration) => aspiration.status === 'active')
    .sort((a, b) => a.position! - b.position!)
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
  const goals = store.goals.filter((goal) => goalIds.has(goal.id)).map(goalOut)
  const recurringItems = store.recurringItems.filter((item) =>
    tasks.some((task) => task.recurringItemId === item.id),
  )
  const aspirationIds = new Set(
    [...goals, ...recurringItems].flatMap((record) => record.aspirationId ?? []),
  )
  const aspirations = store.aspirations.filter((aspiration) => aspirationIds.has(aspiration.id))
  return { goals, recurringItems, aspirations }
}
