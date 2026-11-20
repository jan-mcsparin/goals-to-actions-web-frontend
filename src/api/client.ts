// The functions screens and hooks call. They read the in-memory mock store,
// except that with the switch on real (mode.ts) the aspiration and goal ones
// call the API instead (realAspirations.ts, realGoals.ts), with the same
// signatures.
import { addDays, fromLocalDay, mondayOf, toLocalDay, weekAfter } from './dates.ts'
import { taskWeek } from '../domain/add.ts'
import { checkedOff, inTheBank, isInBank, isPlanned, placedOnDay, uncheckedOff } from '../domain/tasks.ts'
import { isWithinGoal, MOST_SESSIONS, nextMilestone, pushedDates } from '../domain/goalDetail.ts'
import { isIntensity } from '../domain/settings.ts'
import { NotFoundError } from './errors.ts'
import { newDeviceId } from './ids.ts'
import type { StoredCheckIn, StoredGoal, StoredMilestone, StoredTask } from './mockData.ts'
import { store } from './mockStore.ts'
import { realApi } from './mode.ts'
import * as real from './realAspirations.ts'
import * as realGoals from './realGoals.ts'
import type {
  Aspiration,
  AspirationDetail,
  AspirationsOverview,
  Bank,
  DayPlan,
  Goal,
  GoalDetail,
  GoalStatus,
  Intensity,
  ListedGoal,
  Milestone,
  MilestoneEdit,
  NewAspiration,
  NewGoal,
  NewRecurringItem,
  NewTask,
  RecurringItem,
  Settings,
  StillMattersAnswer,
  Task,
  Upkeep,
  WeekPlan,
  WeeklyTarget,
  WeeklyTargetInput,
} from './types.ts'

export { NotFoundError }

// Set-aside tasks keep their day but don't show on it.
export async function getDay(date: string): Promise<DayPlan> {
  const tasks = shown(store.tasks.filter((task) => task.plannedDay === date))
  const stillMatters = shown(store.tasks.filter((task) => task.week === thisWeek() && task.stillMatters))
  return structuredClone({ date, tasks, stillMatters, ...recordsReferencedBy(tasks) })
}

export async function checkOffTask(taskId: string, valueLogged?: number): Promise<Task> {
  const task = findTask(taskId)
  if (task.week !== null && task.week > thisWeek()) throw new Error("Can't check off a task in a week that hasn't started")
  const now = new Date()
  replaceTask(task, checkedOff(task, now.toISOString(), toLocalDay(now)))
  if (valueLogged !== undefined) task.valueLogged = valueLogged
  return taskOut(task)
}

export async function uncheckTask(taskId: string): Promise<Task> {
  const task = findTask(taskId)
  if (task.state !== 'done') throw new Error(`Task ${taskId} is not done`)

  replaceTask(task, uncheckedOff(task))
  return taskOut(task)
}

// The current week, or next week once it's open. Anything else isn't there to read.
export async function getWeek(week: string = thisWeek()): Promise<WeekPlan> {
  const current = thisWeek()
  const isCurrent = week === current
  const open = nextWeekOpen()
  if (!isCurrent && !(open && week === weekAfter(current))) throw new NotFoundError(`No week ${week}`)

  const tasks = shown(store.tasks.filter((task) => task.week === week))
  const targetGoalIds = store.goals
    .filter((goal) => goal.status === 'active' && latestTarget(goal.id))
    .map((goal) => goal.id)
  return structuredClone({
    weekOf: week,
    isCurrent,
    nextWeekOpen: open,
    tasks,
    ...recordsReferencedBy(tasks, targetGoalIds),
  })
}

// Closes the current week early, once next week is open, as the API does: what carries over
// goes to next week's bank, the rest ends, and next week becomes the current one. Sent again,
// it changes nothing.
export async function wrapUpWeek(week: string): Promise<WeekPlan> {
  const current = thisWeek()
  if (week < current) return getWeek()
  if (week > current) throw new Error('Only the current week can be wrapped up')
  if (!nextWeekOpen()) throw new Error('A week can be wrapped up once next week is open')

  const next = weekAfter(current)
  for (const task of store.tasks.filter((candidate) => candidate.week === week && isWaiting(candidate))) {
    if (atCloseOf(task) === 'carriesOver') {
      Object.assign(task, { week: next, plannedDay: null, placedByHand: false, carriedOver: task.carriedOver + 1 })
    } else {
      task.state = 'lapsed'
    }
  }
  store.closedThrough = week
  return getWeek()
}

// Keep it, put it on a day, or drop it. Each ends the question.
export async function answerStillMatters(taskId: string, answer: StillMattersAnswer): Promise<Task> {
  const task = findTask(taskId)
  if (!task.stillMatters) throw new Error(`Task ${taskId} isn't asking`)
  if (answer.answer === 'schedule') {
    checkWeek(task, answer.week)
    checkDay(answer.day, answer.week)
    replaceTask(task, placedOnDay(task, answer.day))
  } else if (answer.answer === 'drop') {
    task.state = 'dropped'
  }
  task.stillMatters = false
  return taskOut(task)
}

export async function getAspirations(): Promise<AspirationsOverview> {
  if (realApi) return real.getAspirations()
  const weekOf = thisWeek()
  return structuredClone({
    aspirations: store.aspirations,
    goals: store.goals.map(listedGoal),
    recurringItems: store.recurringItems.filter((item) => item.active),
    weekTasks: shown(store.tasks.filter((task) => task.week === weekOf && task.goalId !== null)),
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
    weekTasks: shown(
      store.tasks.filter((task) => task.week === weekOf && task.goalId !== null && goalIds.has(task.goalId)),
    ),
    activeCount: activeAspirations().length,
  })
}

// As the API's page: positions and results worked out from the store.
export async function getGoal(goalId: string): Promise<GoalDetail> {
  if (realApi) return realGoals.getGoal(goalId)
  const goal = findGoal(goalId)
  const aspiration = store.aspirations.find((candidate) => candidate.id === goal.aspirationId)
  return structuredClone({
    goal: goalOut(goal),
    aspiration: aspiration ? { id: aspiration.id, name: aspiration.name } : null,
    milestones: milestonesOf(goalId).map(milestoneOut),
    progress: progressOf(goal),
    // Not counted by the mock: no screen reads them until #31 and #42.
    weekProgress: null,
    steps: [],
    latest: latestResult(goalId),
    // Not kept by the mock until a quitting goal's record is built (#37).
    quitRecord: null,
  })
}

// A count target, from this week. A second change in the same week updates
// that week's row, so earlier weeks keep the target they had.
export async function setWeeklyTarget(goalId: string, target: WeeklyTargetInput): Promise<Goal> {
  if (realApi) return realGoals.setWeeklyTarget(goalId, target)
  const goal = findCurrentGoal(goalId)
  const checked = checkedTarget(goal.type, target)

  const weekOf = thisWeek()
  const row = store.weeklyTargets.find((candidate) => candidate.goalId === goalId && candidate.effectiveFrom === weekOf)
  if (row) Object.assign(row, checked)
  else store.weeklyTargets.push({ goalId, ...checked, effectiveFrom: weekOf })
  return structuredClone(goalOut(goal))
}

// Goes after the goal's last milestone, upcoming, never past the deadline.
export async function addMilestone(
  goalId: string,
  milestone: { measurableLine: string; targetDate?: string },
): Promise<GoalDetail> {
  if (realApi) return realGoals.addMilestone(goalId, milestone)
  const goal = findCurrentGoal(goalId)
  const measurableLine = milestone.measurableLine.trim()
  if (!measurableLine) throw new Error('A milestone needs a measurable line')
  const { targetDate } = milestone
  if (targetDate && !isWithinGoal(targetDate, goal)) throw new Error("A milestone's date must fall between the goal's start and its deadline")

  store.milestones.push({ id: newDeviceId(), goalId, measurableLine, status: 'upcoming', targetDate: targetDate ?? null })
  return getGoal(goalId)
}

// Hit or not yet, kept as a check-in dated today with the result. A building
// or quitting goal's milestones are checked in in order, so only Next can be,
// and the goal's own line (no milestone) once every milestone is hit: a hit
// there reaches the goal. A one-off goal's steps can be done in any order.
export async function checkIn(
  goalId: string,
  milestoneId: string | null,
  outcome: 'hit' | 'notYet',
  result?: string,
): Promise<GoalDetail> {
  if (realApi) return realGoals.checkIn(goalId, milestoneId, outcome, result)
  const goal = findCurrentGoal(goalId)
  const next = nextMilestone(milestonesOf(goalId))
  const milestone = milestoneId === null ? undefined : findMilestone(milestoneId)
  if (milestone && milestone.goalId !== goalId) throw new Error(`${milestoneId} isn't one of ${goalId}'s`)
  if (milestone?.status === 'hit') throw new Error(`${milestoneId} is already hit`)
  if (milestone && goal.type !== 'oneOff' && milestone !== next) throw new Error(`${milestoneId} isn't next`)
  if (!milestone && next) throw new Error(`${goalId} has milestones still to hit`)

  const today = toLocalDay(new Date())
  if (milestone) milestone.status = outcome
  else if (outcome === 'hit') Object.assign(goal, { status: 'reached', endedOn: today })
  store.checkIns.push({ id: newDeviceId(), goalId, milestoneId, outcome, result: result?.trim() || null, checkedInOn: today })
  return getGoal(goalId)
}

// Move the date and Adjust the milestone: the line and date, sent whole. A
// not-yet milestone goes back to upcoming; a hit one stays hit. A later date
// pushes the ones after it out. Its check-ins stay.
export async function updateMilestone(milestoneId: string, edit: MilestoneEdit): Promise<GoalDetail> {
  if (realApi) return realGoals.updateMilestone(milestoneId, edit)
  const milestone = findMilestone(milestoneId)
  const goal = findCurrentGoal(milestone.goalId)
  const measurableLine = edit.measurableLine.trim()
  if (!measurableLine) throw new Error('A milestone needs a measurable line')
  const targetDate = edit.targetDate ?? null
  if (targetDate && !isWithinGoal(targetDate, goal)) {
    throw new Error("A milestone's date must fall between the goal's start and its deadline")
  }

  if (targetDate) {
    const moved = pushedDates(goal, milestonesOf(goal.id), milestoneId, targetDate)
    for (const row of moved) findMilestone(row.id).targetDate = row.targetDate
  }
  milestone.targetDate = targetDate
  milestone.measurableLine = measurableLine
  if (milestone.status === 'notYet') milestone.status = 'upcoming'
  return getGoal(goal.id)
}

// Keep the date: a not-yet milestone back to upcoming. An upcoming one stays
// as it is; a hit one can't be kept.
export async function keepMilestone(milestoneId: string): Promise<GoalDetail> {
  if (realApi) return realGoals.keepMilestone(milestoneId)
  const milestone = findMilestone(milestoneId)
  findCurrentGoal(milestone.goalId)
  if (milestone.status === 'hit') throw new Error(`${milestoneId} is already hit`)
  milestone.status = 'upcoming'
  return getGoal(milestone.goalId)
}

// Its not-done tasks this week are set aside, keeping their day,
// as when an aspiration is retired with "Pause them".
export async function pauseGoal(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.pauseGoal(goalId)
  const goal = findGoal(goalId)
  if (goal.status !== 'active') throw new Error(`${goalId} is ${goal.status}`)
  pauseWork([goal], [])
  return structuredClone(goalOut(goal))
}

// Active again, from paused: its set-aside tasks this week go back to the
// bank. Allowed under a retired aspiration: the goal keeps it.
export async function resumeGoal(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.resumeGoal(goalId)
  return changeStatus(goalId, ['paused'], 'active', (goal) => {
    const weekOf = thisWeek()
    for (const task of store.tasks) {
      if (task.goalId === goalId && task.week === weekOf && task.setAside) {
        task.setAside = false
        replaceTask(task, inTheBank(task))
      }
    }
    goal.status = 'active' // a paused goal has no end date to clear
  })
}

// Active again after reaching it by mistake; the end date goes.
export async function reopenGoal(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.reopenGoal(goalId)
  return changeStatus(goalId, ['reached'], 'active', comeBack)
}

// The same goal, active again after ending it; the end date goes.
export async function goAgain(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.goAgain(goalId)
  return changeStatus(goalId, ['ended'], 'active', comeBack)
}

// Ended for now, today. Its tasks stay as they are.
export async function endGoal(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.endGoal(goalId)
  return changeStatus(goalId, ['active', 'paused'], 'ended', (goal) => finish(goal, 'ended'))
}

// Reached today, as a hit on the goal's own line does. Its tasks stay as they are.
export async function markGoalReached(goalId: string): Promise<Goal> {
  if (realApi) return realGoals.markGoalReached(goalId)
  return changeStatus(goalId, ['active', 'paused'], 'reached', (goal) => finish(goal, 'reached'))
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
// not-done tasks this week are set aside, keeping their day.
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
    for (const item of items) item.aspirationId = null
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
    recurringItems: store.recurringItems.filter((item) => item.active && item.aspirationId === null),
    tasks: shown(store.tasks.filter((task) => isLoose(task) && isWaiting(task) && (task.week ?? '') >= weekOf)),
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

// The current week's bank, or next week's once it's open.
export async function getBank(week: string = thisWeek()): Promise<Bank> {
  if (week !== thisWeek() && !(nextWeekOpen() && week === weekAfter(thisWeek()))) {
    throw new NotFoundError(`No week ${week}`)
  }
  const weekOf = week
  const tasks = shown(store.tasks.filter((task) => isInBank(task) && !task.setAside && task.week === weekOf))
  return structuredClone({ weekOf, tasks, ...recordsReferencedBy(tasks) })
}

// In the bank of this week, or of its due week when that's later. With
// onToday it goes on today's plan, placed by hand, whatever its due date.
export async function addTask(task: NewTask): Promise<Task> {
  const title = task.title.trim()
  if (!title) throw new Error('A task needs a title')
  if (task.goalId) findActiveGoal(task.goalId)

  const today = toLocalDay(new Date())
  const added = newStoredTask({
    title,
    origin: 'byHand',
    week: taskWeek(task.dueDate, today),
    goalId: task.goalId ?? null,
    dueDate: task.dueDate ?? null,
    timeOfDay: task.timeOfDay ? { ...task.timeOfDay } : null,
  })
  if (task.onToday) replaceTask(added, placedOnDay({ ...added, week: thisWeek() }, today))
  store.tasks.push(added)
  return taskOut(added)
}

// The planner's stand-in adds no more than one task a day, so a typo in a
// weekly target can't flood the bank.
const MOST_STAND_IN_TASKS = 7

// Its id is made here, on the device. Everything is checked before anything
// is stored. A weekly target's tasks stand in for the planner, so the new
// goal can be followed into the week.
export async function createGoal(goal: NewGoal): Promise<Goal> {
  if (realApi) return realGoals.createGoal(goal)
  const label = goal.label.trim()
  const measurableLine = goal.measurableLine.trim()
  if (!label || !measurableLine) throw new Error('A goal needs a label and a measurable line')
  if (goal.aspirationId) findActiveAspiration(goal.aspirationId)
  const startDate = goal.startDate ?? toLocalDay(new Date())
  if (goal.deadline && !isWithinGoal(goal.deadline, { startDate })) throw new Error("A goal's deadline can't come before its start")
  const target = goal.weeklyTarget && checkedTarget(goal.type, goal.weeklyTarget)

  const added: StoredGoal = {
    id: newDeviceId(),
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
      store.tasks.push(newStoredTask({ title: label, origin: 'weeklyTarget', week: weekOf, goalId: added.id }))
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
    aspirationId: item.aspirationId ?? null,
    fromGoalId: item.fromGoalId ?? null,
    schedule: item.schedule,
    startsOn: item.startsOn,
    active: true,
    createdAt: new Date().toISOString(),
  }
  store.recurringItems.push(added)
  return structuredClone(added)
}

// Back to the bank, in the week the change was made in; the day is cleared and the rollover
// count stays. Refused once the task has left that week, as the API does (a 409).
export async function moveTaskToBank(taskId: string, week: string): Promise<Task> {
  const task = findPlannedTask(taskId)
  checkWeek(task, week)
  replaceTask(task, inTheBank(task))
  return taskOut(task)
}

// Onto a day of its week, placed by hand.
export async function placeTask(taskId: string, week: string, day: string): Promise<Task> {
  const task = findBankTask(taskId)
  checkWeek(task, week)
  checkDay(day, week)
  replaceTask(task, placedOnDay(task, day))
  return taskOut(task)
}

// Both tasks are checked before either changes, so a bad ID changes nothing.
// The bank task goes onto the given day, and the other goes to the bank.
export async function swapTasks(
  taskId: string,
  { week, bankTaskId, day }: { week: string; bankTaskId: string; day: string },
): Promise<{ toBank: Task; placed: Task }> {
  const toBank = findPlannedTask(taskId)
  const placed = findBankTask(bankTaskId)
  checkWeek(toBank, week)
  checkWeek(placed, week)
  checkDay(day, week)
  replaceTask(toBank, inTheBank(toBank))
  replaceTask(placed, placedOnDay(placed, day))
  return { toBank: taskOut(toBank), placed: taskOut(placed) }
}

function checkWeek(task: Task, week: string) {
  if (task.week !== week) throw new Error(`Task ${task.id} has moved on to another week`)
}

function checkDay(day: string, week: string) {
  if (day < toLocalDay(new Date())) throw new Error("Can't place a task on a past day")
  if (toLocalDay(mondayOf(fromLocalDay(day))) !== week) throw new Error("A task goes on a day in its own week")
}

// The mock keeps one object per task, so a change made on a copy is put back on it.
function replaceTask(stored: StoredTask, next: Task) {
  Object.assign(stored, next)
}

// A task as the API sends it: without what only the mock keeps, and with what closing would do.
function taskOut({ setAside: _setAside, ...task }: StoredTask): Task {
  return structuredClone({ ...task, atClose: atCloseOf(task) })
}

// What closing its week does to a task that's still open: by-hand and fixed-day tasks carry
// over; a goal's session or a flexible item's task ends with the week. The server decides this
// (ADR-008); the mock only imitates it.
function atCloseOf(task: Task & { setAside?: boolean }): Task['atClose'] {
  if (task.state !== 'open' || task.setAside || task.week === null) return null
  if (task.origin === 'byHand') return 'carriesOver'
  if (task.origin === 'weeklyTarget') return 'ends'
  const item = store.recurringItems.find((candidate) => candidate.id === task.recurringItemId)
  return item?.schedule.kind === 'flexible' ? 'ends' : 'carriesOver'
}

// What the API would send: set-aside, dropped and lapsed tasks aren't shown.
function shown(tasks: StoredTask[]): Task[] {
  return tasks
    .filter((task) => !task.setAside && (task.state === 'open' || task.state === 'done'))
    .map(taskOut)
}

function newStoredTask(fields: Pick<StoredTask, 'title' | 'origin'> & Partial<StoredTask>): StoredTask {
  return {
    id: newId('task'),
    state: 'open',
    goalId: null,
    goalLabel: null,
    recurringItemId: null,
    dueDate: null,
    timeOfDay: null,
    valueLogged: null,
    completedAt: null,
    completedOn: null,
    week: null,
    plannedDay: null,
    placedByHand: false,
    carriedOver: 0,
    atClose: null,
    stillMatters: false,
    setAside: false,
    ...fields,
  }
}

function findPlannedTask(taskId: string): StoredTask {
  const task = findTask(taskId)
  if (!isPlanned(task) || task.setAside) throw new Error(`Task ${taskId} is not planned`)
  return task
}

function findBankTask(taskId: string): StoredTask {
  const task = findTask(taskId)
  if (!isInBank(task) || task.setAside) throw new Error(`Task ${taskId} is not in the bank`)
  return task
}

function isLoose(task: Task): boolean {
  return task.goalId === null && task.recurringItemId === null
}

// On a day or in the bank: not done, and not set aside.
function isWaiting(task: StoredTask): boolean {
  return task.state === 'open' && !task.setAside
}

// The later of the phone's week and the week after the last one wrapped up.
function thisWeek(): string {
  const phones = toLocalDay(mondayOf(new Date()))
  return store.closedThrough !== null && weekAfter(store.closedThrough) > phones ? weekAfter(store.closedThrough) : phones
}

// From 6 p.m. on the current week's Sunday (ADR-009), by the device clock.
function nextWeekOpen(): boolean {
  const opensAt = addDays(fromLocalDay(thisWeek()), 6)
  opensAt.setHours(18, 0, 0, 0)
  return new Date() >= opensAt
}

// A goal as the API sends it: with its latest target, and whether it has slipped.
function goalOut(goal: StoredGoal): Goal {
  const slipped = goal.status === 'active' && goal.deadline !== null && goal.deadline < toLocalDay(new Date())
  return { ...goal, slipped, weeklyTarget: latestTarget(goal.id) ?? null }
}

// As listGoals sends it: "2 of 6" is milestones hit plus the goal itself. A
// reached goal counts complete: milestones never checked in were passed on the way.
function listedGoal(goal: StoredGoal): ListedGoal {
  return { ...goalOut(goal), progress: progressOf(goal), weekProgress: null }
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
// check-in's result while it's hit or not yet. A hit is always a milestone's
// last check-in, so the newest is the one.
function milestoneOut(milestone: StoredMilestone): Milestone {
  const { goalId, ...fields } = milestone
  const position = milestonesOf(goalId).indexOf(milestone) + 1
  if (milestone.status === 'upcoming') return { ...fields, position, result: null }
  const latest = newest(store.checkIns.filter((checkIn) => checkIn.milestoneId === milestone.id))
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
  if (!Number.isInteger(target.sessions) || target.sessions < 1 || target.sessions > MOST_SESSIONS) {
    throw new Error(`A weekly target is a whole number from 1 to ${MOST_SESSIONS}`)
  }
  if (!unit) throw new Error('A weekly target needs a unit')
  return { kind: target.kind, sessions: target.sessions, amount: target.amount ?? null, unit }
}

// As the API: each change is allowed from its own statuses, and sent again
// (the goal already there) returns the goal unchanged.
function changeStatus(goalId: string, from: GoalStatus[], to: GoalStatus, change: (goal: StoredGoal) => void): Goal {
  const goal = findGoal(goalId)
  if (goal.status !== to) {
    if (!from.includes(goal.status)) throw new Error(`${goalId} is ${goal.status}`)
    change(goal)
  }
  return structuredClone(goalOut(goal))
}

function finish(goal: StoredGoal, outcome: 'reached' | 'ended') {
  goal.status = outcome
  goal.endedOn = toLocalDay(new Date())
}

function comeBack(goal: StoredGoal) {
  goal.status = 'active'
  goal.endedOn = null
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
    if (belongs && task.week === weekOf && isWaiting(task)) task.setAside = true
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

function findTask(taskId: string): StoredTask {
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
