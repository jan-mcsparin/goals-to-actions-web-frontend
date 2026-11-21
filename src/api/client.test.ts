import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAspiration,
  addMilestone,
  addRecurringItem,
  addTask,
  bringBackAspiration,
  checkIn,
  checkOffTask,
  createGoal,
  endGoal,
  getAspiration,
  getAspirations,
  getGoal,
  getSettings,
  getUpkeep,
  getWeek,
  goAgain,
  keepMilestone,
  markGoalReached,
  moveAspiration,
  NotFoundError,
  pauseGoal,
  RefusedError,
  placeTask,
  reopenGoal,
  resumeGoal,
  retireAspiration,
  setIntensity,
  setWeeklyTarget,
  moveTaskToBank,
  swapTasks,
  uncheckTask,
  updateAspiration,
  updateMilestone,
} from './client.ts'
import type { StoredTask, StoredWeeklyTarget } from './mockData.ts'
import { resetStore, store } from './mockStore.ts'
import { readBank, readDay } from '../test/plan.ts'
import type { Goal, ListedGoal, NewRecurringItem, Task, WeeklyTargetInput } from './types.ts'
import { aTask, whereIs } from '../test/tasks.ts'

// A task as the mock stores it.
function aStoredTask(id: string, fields: Partial<StoredTask> = {}): StoredTask {
  return { ...aTask(id, fields), setAside: false, ...fields }
}

// Wednesday 11 Nov 2026, 9 a.m. local time.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)
const WEDNESDAY_DAY = '2026-11-11'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
// A check-off tapped on Wednesday morning: what the phone saw.
const TAPPED = { completedAt: WEDNESDAY.toISOString(), completedOn: WEDNESDAY_DAY }

function ids(records: { id: string }[]) {
  return records.map((record) => record.id).sort()
}

// Each goal that has a weekly target, with its sessions, in the order given.
function targetsOf(goals: Pick<Goal, 'id' | 'weeklyTarget'>[]): [string, number][] {
  return goals.flatMap((goal) => (goal.weeklyTarget ? [[goal.id, goal.weeklyTarget.sessions] as [string, number]] : []))
}

function progressOf(goals: ListedGoal[]): Record<string, ListedGoal['progress']> {
  return Object.fromEntries(goals.map((goal) => [goal.id, goal.progress]))
}

// A stored target row, as setWeeklyTarget writes one.
function countRow(goalId: string, sessions: number, unit: string, effectiveFrom: string): StoredWeeklyTarget {
  return { goalId, kind: 'count', sessions, amount: null, unit, effectiveFrom }
}

// A count target as the Add sheet sends one.
function countOf(sessions: number, unit: string): WeeklyTargetInput {
  return { kind: 'count', sessions, unit }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(WEDNESDAY)
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

// getDay went (ADR-010): a day is drawn from its week. These check the mock's week gives it.
describe('a day, drawn from the week', () => {
  it("returns only tasks planned for today's date", async () => {
    const plan = await readDay(WEDNESDAY_DAY)

    expect(plan.date).toBe('2026-11-11')
    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.tasks.every((task) => task.plannedDay === '2026-11-11')).toBe(true)
  })

  it('includes a mix of timed, untimed, goal, maintenance and unlinked tasks', async () => {
    const { tasks } = await readDay(WEDNESDAY_DAY)

    expect(tasks.some((task) => task.timeOfDay?.kind === 'by')).toBe(true)
    expect(tasks.some((task) => task.timeOfDay?.kind === 'at')).toBe(true)
    expect(tasks.some((task) => !task.timeOfDay)).toBe(true)
    expect(tasks.some((task) => task.goalId)).toBe(true)
    expect(tasks.some((task) => task.recurringItemId)).toBe(true)
    expect(tasks.some((task) => !task.goalId && !task.recurringItemId)).toBe(true)
  })

  it('returns the tasks of whichever day is asked for', async () => {
    const plan = await readDay('2026-11-10')

    expect(plan.date).toBe('2026-11-10')
    expect(plan.tasks.map((task) => task.id)).toEqual(['task-trash'])
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await readDay(WEDNESDAY_DAY)
    first.tasks[0].title = 'changed'

    const second = await readDay(WEDNESDAY_DAY)
    expect(second.tasks[0].title).not.toBe('changed')
  })
})

describe('checkOffTask', () => {
  it('marks the task done with the moment it was tapped and returns it', async () => {
    const task = await checkOffTask('task-lift-today', TAPPED)

    expect(whereIs(task)).toBe('done')
    expect(task.completedAt).toBe(WEDNESDAY.toISOString())
    expect(task.completedOn).toBe(WEDNESDAY_DAY)
  })

  it('keeps the moment sent, not the clock when it saves: a queued check-off saves later', async () => {
    vi.setSystemTime(new Date(2026, 10, 12, 8, 0))

    const task = await checkOffTask('task-lift-today', TAPPED)

    expect(task.completedAt).toBe(WEDNESDAY.toISOString())
    expect(task.completedOn).toBe(WEDNESDAY_DAY)
  })

  it('stores a logged value when given', async () => {
    const task = await checkOffTask('task-lift-today', { ...TAPPED, valueLogged: 155 })

    expect(task.valueLogged).toBe(155)
  })

  it('is reflected in the next week read', async () => {
    await checkOffTask('task-laundry', TAPPED)

    const { tasks } = await readDay(WEDNESDAY_DAY)
    expect(statusIn(tasks, 'task-laundry')).toBe('done')
  })

  it('is undone by resetStore', async () => {
    await checkOffTask('task-laundry', TAPPED)
    resetStore()

    const { tasks } = await readDay(WEDNESDAY_DAY)
    expect(statusIn(tasks, 'task-laundry')).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(checkOffTask('no-such-task', TAPPED)).rejects.toThrow('no-such-task')
  })

  it('returns a copy, so changing it does not change the store', async () => {
    const task = await checkOffTask('task-laundry', TAPPED)
    task.state = 'open'

    const { tasks } = await readDay(WEDNESDAY_DAY)
    expect(tasks.find((t) => t.id === 'task-laundry')?.state).toBe('done')
  })
})

describe('uncheckTask', () => {
  it('puts a done task back to planned and clears what check-off set', async () => {
    await checkOffTask('task-lift-today', { ...TAPPED, valueLogged: 155 })

    const task = await uncheckTask('task-lift-today')

    expect(whereIs(task)).toBe('planned')
    expect(task.completedAt).toBeNull()
    expect(task.valueLogged).toBeNull()
  })

  it('is reflected in the next week read', async () => {
    await checkOffTask('task-laundry', TAPPED)
    await uncheckTask('task-laundry')

    const { tasks } = await readDay(WEDNESDAY_DAY)
    expect(statusIn(tasks, 'task-laundry')).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(uncheckTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not done', async () => {
    await expect(uncheckTask('task-laundry')).rejects.toThrow('not done')
  })
})

function statusIn(tasks: Task[], taskId: string) {
  const task = tasks.find((candidate) => candidate.id === taskId)
  return task && whereIs(task)
}

describe('the bank, drawn from the week', () => {
  it("is this week's open tasks not on a day", async () => {
    const bank = await readBank()

    expect(bank.week).toBe('2026-11-09')
    expect(ids(bank.tasks)).toEqual(['task-dentist', 'task-garage-shelves', 'task-lift-bank', 'task-run-bank'])
  })
})

const THIS_WEEK = '2026-11-09'
const NEXT_WEEK = '2026-11-16'

describe('moveTaskToBank', () => {
  it('sends a planned task back to the bank without counting a rollover', async () => {
    const task = await moveTaskToBank('task-laundry', THIS_WEEK)

    expect(whereIs(task)).toBe('inBank')
    expect(task.plannedDay).toBeNull()
    expect(task.carriedOver).toBe(0)
  })

  it('is reflected in the next week read, on the day and in the bank', async () => {
    await moveTaskToBank('task-laundry', THIS_WEEK)

    expect(statusIn((await readDay(WEDNESDAY_DAY)).tasks, 'task-laundry')).toBeUndefined()
    expect(statusIn((await readBank()).tasks, 'task-laundry')).toBe('inBank')
  })

  it('rejects an unknown task id', async () => {
    await expect(moveTaskToBank('no-such-task', THIS_WEEK)).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not planned', async () => {
    await checkOffTask('task-laundry', TAPPED)

    await expect(moveTaskToBank('task-laundry', THIS_WEEK)).rejects.toThrow('not planned')
    await expect(moveTaskToBank('task-lift-bank', THIS_WEEK)).rejects.toThrow('not planned')
  })

  it('refuses a week the task has left, and changes nothing', async () => {
    await expect(moveTaskToBank('task-laundry', NEXT_WEEK)).rejects.toThrow('another week')

    expect(statusIn((await readDay(WEDNESDAY_DAY)).tasks, 'task-laundry')).toBe('planned')
  })
})

describe('placeTask', () => {
  it('plans a bank task for a day, marked as placed by hand', async () => {
    const task = await placeTask('task-lift-bank', THIS_WEEK, '2026-11-13')

    expect(task).toMatchObject({ state: 'open', plannedDay: '2026-11-13', placedByHand: true })
    expect((await readDay('2026-11-13')).tasks.map((t) => t.id)).toContain('task-lift-bank')
  })

  it('is reflected in the next week read, on the day and in the bank', async () => {
    await placeTask('task-lift-bank', THIS_WEEK, WEDNESDAY_DAY)

    expect(statusIn((await readDay(WEDNESDAY_DAY)).tasks, 'task-lift-bank')).toBe('planned')
    expect(statusIn((await readBank()).tasks, 'task-lift-bank')).toBeUndefined()
  })

  it('rejects an unknown task id', async () => {
    await expect(placeTask('no-such-task', THIS_WEEK, WEDNESDAY_DAY)).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not in the bank', async () => {
    await expect(placeTask('task-laundry', THIS_WEEK, WEDNESDAY_DAY)).rejects.toThrow('not in the bank')
  })

  it('refuses a past day, and a day outside the week', async () => {
    await expect(placeTask('task-lift-bank', THIS_WEEK, '2026-11-10')).rejects.toThrow("Can't place a task on a past day")
    await expect(placeTask('task-lift-bank', THIS_WEEK, '2026-11-16')).rejects.toThrow('in its own week')
    expect(statusIn((await readBank()).tasks, 'task-lift-bank')).toBe('inBank')
  })

  it('refuses a week the task is not in, and changes nothing', async () => {
    await expect(placeTask('task-lift-bank', NEXT_WEEK, '2026-11-17')).rejects.toThrow('another week')

    expect(statusIn((await readBank()).tasks, 'task-lift-bank')).toBe('inBank')
  })
})

// What the API answers with 404 or 409, so a queued change that no longer applies is dropped.
describe('refusals, as the API answers them', () => {
  it('says a task that is not there is not found', async () => {
    await expect(checkOffTask('no-such-task', TAPPED)).rejects.toBeInstanceOf(NotFoundError)
    await expect(placeTask('no-such-task', THIS_WEEK, WEDNESDAY_DAY)).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([
    ['uncheck one not done', () => uncheckTask('task-laundry')],
    ['send one not planned to the bank', () => moveTaskToBank('task-lift-bank', THIS_WEEK)],
    ['send one to the bank in a week it has left', () => moveTaskToBank('task-laundry', NEXT_WEEK)],
    ['place one on a past day', () => placeTask('task-lift-bank', THIS_WEEK, '2026-11-10')],
    ['place one in a week it has left', () => placeTask('task-lift-bank', NEXT_WEEK, '2026-11-17')],
    ['swap one not planned', () => swapTasks('task-lift-bank', { week: THIS_WEEK, bankTaskId: 'task-lift-bank', day: WEDNESDAY_DAY })],
  ])('refuses to %s', async (_, change) => {
    await expect(change()).rejects.toBeInstanceOf(RefusedError)
  })
})

describe('swapTasks', () => {
  const swap = { week: THIS_WEEK, bankTaskId: 'task-lift-bank', day: WEDNESDAY_DAY }

  it('sends one task to the bank and plans the other for the day, each keeping its own time', async () => {
    const { toBank, placed } = await swapTasks('task-lift-today', swap)

    expect(toBank).toMatchObject({ id: 'task-lift-today', plannedDay: null, timeOfDay: { kind: 'at', time: '18:00' } })
    expect(placed).toMatchObject({ id: 'task-lift-bank', state: 'open', plannedDay: '2026-11-11' })
    expect(placed.timeOfDay).toBeNull()
  })

  it('puts the bank task on the day given, by hand, and the other back as not by hand', async () => {
    await placeTask('task-dentist', THIS_WEEK, '2026-11-12')

    const { toBank, placed } = await swapTasks('task-dentist', { ...swap, day: '2026-11-12' })

    expect(placed).toMatchObject({ plannedDay: '2026-11-12', placedByHand: true })
    expect(toBank.placedByHand).toBe(false)
  })

  it.each([
    ['no-such-task', 'task-lift-bank'],
    ['task-lift-today', 'no-such-task'],
    ['task-lift-today', 'task-laundry'],
  ])('changes nothing when either side is invalid (%s, %s)', async (taskId, bankTaskId) => {
    const before = await readDay(WEDNESDAY_DAY)

    await expect(swapTasks(taskId, { ...swap, bankTaskId })).rejects.toThrow()

    expect(await readDay(WEDNESDAY_DAY)).toEqual(before)
    expect(statusIn((await readBank()).tasks, 'task-lift-bank')).toBe('inBank')
  })

  it('refuses a week the tasks have left, and changes nothing', async () => {
    const before = await readDay(WEDNESDAY_DAY)

    await expect(swapTasks('task-lift-today', { ...swap, week: NEXT_WEEK })).rejects.toThrow('another week')

    expect(await readDay(WEDNESDAY_DAY)).toEqual(before)
  })
})

describe('moving a placed task', () => {
  it('forgets placedByHand when a task goes back to the bank', async () => {
    await placeTask('task-lift-bank', THIS_WEEK, '2026-11-12')

    const task = await moveTaskToBank('task-lift-bank', THIS_WEEK)

    expect(task.placedByHand).toBe(false)
  })
})

describe('getWeek', () => {
  it("returns every task in this week, planned, done and in the bank", async () => {
    const week = await getWeek()

    expect(week.week).toBe('2026-11-09')
    const statuses = new Map(week.tasks.map((task) => [task.id, whereIs(task)]))
    expect(statuses.get('task-lift-mon')).toBe('done')
    expect(statuses.get('task-lift-today')).toBe('planned')
    expect(statuses.get('task-lift-bank')).toBe('inBank')
    expect(statuses.get('task-groceries')).toBe('planned')
    expect(week.tasks.every((task) => task.week === '2026-11-09')).toBe(true)
  })

  // WeekPlan's goals, aspirations and recurring items became the API's Week: its goals are
  // the active building goals with a target that week, each with its progress.
  it("gives each active building goal with a target its progress this week", async () => {
    const { goals } = await getWeek()

    expect(goals.map(({ id, progress }) => [id, progress])).toEqual([
      ['goal-strong', { done: 1, of: 3 }],
      ['goal-endurance', { done: 1, of: 2 }],
    ])
  })

  it("marks each day's cap and whether it's full, as the API does", async () => {
    store.settings.intensity = 'easingOff'
    for (const id of ['a', 'b', 'c']) store.tasks.push({ ...aTask(id, { week: THIS_WEEK, plannedDay: '2026-11-13' }), setAside: false })

    const { days } = await getWeek()

    expect(days.map((day) => day.day)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(days.every((day) => day.cap === 3)).toBe(true)
    expect(days.find((day) => day.day === '2026-11-13')?.full).toBe(true)
  })

  it('includes a goal that has a target but no tasks this week, with its aspiration', async () => {
    const others = store.tasks.filter((task) => task.goalId !== 'goal-strong')
    store.tasks.splice(0, store.tasks.length, ...others)

    const week = await getWeek()

    expect(targetsOf(week.goals)).toEqual([['goal-strong', 3], ['goal-endurance', 2]])
    expect(week.goals.find((goal) => goal.id === 'goal-strong')?.aspiration?.id).toBe('asp-fit')
  })

  it("names each task's aspiration, by its goal, with its priority", async () => {
    const { tasks } = await getWeek()
    const byId = new Map(tasks.map((task) => [task.id, task]))

    expect(byId.get('task-lift-today')?.aspiration).toEqual({ id: 'asp-fit', name: 'Be fit', position: 1 })
    expect(byId.get('task-groceries')?.aspiration).toBeNull()
  })

  it("names a recurring item's aspiration on its task with no goal", async () => {
    const trash = (await getWeek()).tasks.find((task) => task.recurringItemId === 'rec-trash')

    expect(trash?.aspiration?.id).toBe('asp-home')
  })

  it('names a retired aspiration with no priority', async () => {
    const fit = store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')!
    Object.assign(fit, { status: 'retired', position: null, retiredOn: '2026-11-10' })

    const lift = (await getWeek()).tasks.find((task) => task.id === 'task-lift-today')

    expect(lift?.aspiration).toEqual({ id: 'asp-fit', name: 'Be fit', position: null })
  })

  it("marks a weekly or monthly item's task fixed to its day, and no other", async () => {
    const { tasks } = await getWeek()
    const fixed = (recurringItemId: string) => tasks.filter((task) => task.recurringItemId === recurringItemId).map((task) => task.fixedDay)

    expect(fixed('rec-trash')).toEqual([true])
    expect(fixed('rec-laundry').every((isFixed) => !isFixed)).toBe(true)
    expect(tasks.find((task) => task.id === 'task-groceries')?.fixedDay).toBe(false)
  })

  it("gives each goal its weekly target, as the API sends it", async () => {
    const { goals } = await getWeek()

    expect(goals.find((goal) => goal.id === 'goal-strong')?.weeklyTarget).toEqual({
      kind: 'count',
      sessions: 3,
      amount: null,
      unit: 'lifting sessions',
      effectiveFrom: '2026-10-05',
    })
    expect(goals.find((goal) => goal.id === 'goal-endurance')?.weeklyTarget).toMatchObject({ sessions: 2, unit: 'runs' })
  })

  it('reflects changes made through the other functions', async () => {
    await placeTask('task-lift-bank', THIS_WEEK, '2026-11-14')

    const lift = (await getWeek()).tasks.find((task) => task.id === 'task-lift-bank')
    expect(lift).toMatchObject({ state: 'open', plannedDay: '2026-11-14', placedByHand: true })
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getWeek()
    first.tasks[0].title = 'changed'

    expect((await getWeek()).tasks[0].title).not.toBe('changed')
  })
})

describe('getAspirations', () => {
  it('returns active and retired aspirations, and goals of every status', async () => {
    const overview = await getAspirations()

    expect(ids(overview.aspirations)).toEqual(['asp-fit', 'asp-home', 'asp-spanish'])
    expect(new Set(overview.goals.map((goal) => goal.status))).toEqual(new Set(['active', 'paused', 'reached']))
    expect(overview.goals).toHaveLength(store.goals.length)
  })

  // As the API counts it: milestones hit, plus the goal itself, which a
  // reached goal fills (milestones never checked in were passed on the way).
  it('gives each goal its progress, a reached goal complete', async () => {
    store.milestones.push({ id: 'ms-5k-1', goalId: 'goal-5k', measurableLine: 'Run 3k', status: 'upcoming', targetDate: null })

    const { goals } = await getAspirations()

    expect(progressOf(goals)).toMatchObject({
      'goal-strong': { hit: 1, of: 6 },
      'goal-endurance': { hit: 2, of: 4 },
      'goal-look-good': { hit: 0, of: 3 },
      'goal-garage': { hit: 3, of: 6 },
      'goal-5k': { hit: 2, of: 2 },
      'goal-taxes': { hit: 1, of: 1 },
      'goal-cook': { hit: 0, of: 1 },
    })
  })

  it('returns only active recurring items', async () => {
    store.recurringItems.find((item) => item.id === 'rec-hockey')!.active = false

    const { recurringItems } = await getAspirations()

    expect(ids(recurringItems)).toEqual(['rec-laundry', 'rec-rent', 'rec-stretch', 'rec-trash'])
  })

  // As the API does: the latest target, which can start next week, on a goal of any status.
  it('gives each goal its latest weekly target', async () => {
    store.weeklyTargets.push(
      countRow('goal-strong', 4, 'lifting sessions', '2026-11-16'),
      countRow('goal-cook', 5, 'dinners', '2026-10-05'),
    )

    const { goals } = await getAspirations()

    expect(targetsOf(goals)).toEqual([['goal-strong', 4], ['goal-endurance', 2], ['goal-cook', 5]])
  })

  // weekTasks became the week read's goals: the bars count from them (#42).
  it("returns this week's goals with their progress, as the week read sends them", async () => {
    const { weekGoals } = await getAspirations()

    expect(weekGoals).toEqual((await getWeek()).goals)
  })

  it("counts against the target in force this week, not a newer one that starts next week", async () => {
    store.weeklyTargets.push({ goalId: 'goal-strong', kind: 'count', sessions: 5, amount: null, unit: 'lifting sessions', effectiveFrom: '2026-11-16' })

    const { weekGoals } = await getAspirations()

    expect(weekGoals.find((goal) => goal.id === 'goal-strong')?.progress.of).toBe(3)
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getAspirations()
    first.aspirations[0].name = 'changed'
    first.goals[0].label = 'changed'

    const second = await getAspirations()
    expect(second.aspirations[0].name).toBe('Be fit')
    expect(second.goals[0].label).toBe('Be strong')
  })
})

describe('getAspiration', () => {
  it('returns the aspiration with its goals of every status, each with its progress', async () => {
    const detail = await getAspiration('asp-fit')

    expect(detail.aspiration).toMatchObject({ id: 'asp-fit', name: 'Be fit', position: 1 })
    expect(ids(detail.goals)).toEqual(['goal-5k', 'goal-endurance', 'goal-look-good', 'goal-strong'])
    expect(progressOf(detail.goals)).toEqual({
      'goal-strong': { hit: 1, of: 6 },
      'goal-endurance': { hit: 2, of: 4 },
      'goal-look-good': { hit: 0, of: 3 },
      'goal-5k': { hit: 1, of: 1 },
    })
  })

  it('returns its recurring items, active or not', async () => {
    store.recurringItems.find((item) => item.id === 'rec-hockey')!.active = false

    const { recurringItems } = await getAspiration('asp-fit')

    expect(ids(recurringItems)).toEqual(['rec-hockey', 'rec-stretch'])
  })

  it("returns its goals' targets and this week's goals under it only", async () => {
    store.goals.find((goal) => goal.id === 'goal-garage')!.type = 'building'
    store.weeklyTargets.push({ goalId: 'goal-garage', kind: 'count', sessions: 1, amount: null, unit: 'sessions', effectiveFrom: '2026-10-05' })

    const { goals, weekGoals } = await getAspiration('asp-fit')

    expect(targetsOf(goals)).toEqual([['goal-strong', 3], ['goal-endurance', 2]])
    expect(ids(weekGoals)).toEqual(['goal-endurance', 'goal-strong'])
  })

  it('counts the active aspirations', async () => {
    const { activeCount } = await getAspiration('asp-home')

    expect(activeCount).toBe(2)
  })

  it('returns a retired aspiration with its reached goal and no priority', async () => {
    const detail = await getAspiration('asp-spanish')

    expect(detail.aspiration.status).toBe('retired')
    expect(detail.aspiration.position).toBeNull()
    expect(ids(detail.goals)).toEqual(['goal-spanish-a2'])
  })

  it('rejects an unknown id as not found', async () => {
    await expect(getAspiration('asp-nope')).rejects.toThrow(NotFoundError)
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getAspiration('asp-fit')
    first.aspiration.name = 'changed'
    first.goals[0].label = 'changed'

    const second = await getAspiration('asp-fit')
    expect(second.aspiration.name).toBe('Be fit')
    expect(second.goals.map((goal) => goal.label)).not.toContain('changed')
  })
})

describe('getGoal', () => {
  it('returns the goal with its aspiration, its milestones in order and the target in force', async () => {
    const detail = await getGoal('goal-strong')

    expect(detail.goal).toMatchObject({ id: 'goal-strong', label: 'Be strong' })
    expect(detail.aspiration).toMatchObject({ id: 'asp-fit', name: 'Be fit' })
    expect(detail.milestones.map((milestone) => milestone.id)).toEqual([
      'ms-strong-1',
      'ms-strong-2',
      'ms-strong-3',
      'ms-strong-4',
      'ms-strong-5',
    ])
    expect(detail.milestones[1].status).toBe('notYet')
    expect(detail.goal.weeklyTarget).toMatchObject({ sessions: 3, unit: 'lifting sessions', effectiveFrom: '2026-10-05' })
  })

  // The API's page: each milestone's position and latest result (none while
  // upcoming), progress, the latest check-in with a result, and the aspiration.
  it("returns the API's page for a goal", async () => {
    const detail = await getGoal('goal-strong')

    expect(detail.aspiration).toEqual({ id: 'asp-fit', name: 'Be fit' })
    expect(detail.milestones.slice(0, 3)).toEqual([
      { id: 'ms-strong-1', position: 1, measurableLine: 'Bench 150, squat 285, deadlift 325', targetDate: '2026-11-02', status: 'hit', result: 'Bench 150, squat 290, deadlift 330' },
      { id: 'ms-strong-2', position: 2, measurableLine: 'Bench 155, squat 300, deadlift 345', targetDate: '2026-11-06', status: 'notYet', result: 'Bench 152, squat 300, deadlift 340' },
      { id: 'ms-strong-3', position: 3, measurableLine: 'Bench 160, squat 310, deadlift 355', targetDate: '2026-11-30', status: 'upcoming', result: null },
    ])
    expect(detail.progress).toEqual({ hit: 1, of: 6 })
    expect(detail.latest).toEqual({ result: 'Bench 152, squat 300, deadlift 340', checkedInOn: '2026-11-06' })
  })

  it("gives every goal the progress the Aspirations tab lists for it", async () => {
    const { goals } = await getAspirations()

    for (const goal of goals) expect((await getGoal(goal.id)).progress).toEqual(goal.progress)
  })

  it('has no latest result before any check-in with one, and no aspiration for a loose goal', async () => {
    const detail = await getGoal('goal-taxes')

    expect(detail.latest).toBeNull()
    expect(detail.aspiration).toBeNull()
  })

  // As the API does: a change waiting for next week shows, with its effectiveFrom.
  it('returns the latest target, even one that starts next week', async () => {
    store.weeklyTargets.push(
      countRow('goal-strong', 4, 'lifting sessions', '2026-11-09'),
      countRow('goal-strong', 5, 'lifting sessions', '2026-11-16'),
    )

    const { goal } = await getGoal('goal-strong')

    expect(goal.weeklyTarget).toMatchObject({ sessions: 5, effectiveFrom: '2026-11-16' })
  })

  it('still returns the target of a paused goal', async () => {
    store.goals.find((goal) => goal.id === 'goal-strong')!.status = 'paused'

    const { goal } = await getGoal('goal-strong')

    expect(goal.weeklyTarget).toMatchObject({ sessions: 3, effectiveFrom: '2026-10-05' })
  })

  it('returns a goal with no aspiration, milestones or target', async () => {
    const detail = await getGoal('goal-taxes')

    expect(detail.goal.status).toBe('reached')
    expect(detail.aspiration).toBeNull()
    expect(detail.milestones).toEqual([])
    expect(detail.goal.weeklyTarget).toBeNull()
  })

  it('returns a paused goal with no target', async () => {
    const detail = await getGoal('goal-cook')

    expect(detail.goal.status).toBe('paused')
    expect(detail.aspiration?.id).toBe('asp-home')
    expect(detail.goal.weeklyTarget).toBeNull()
  })

  it('rejects an unknown id as not found', async () => {
    await expect(getGoal('goal-nope')).rejects.toThrow(NotFoundError)
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getGoal('goal-strong')
    first.goal.label = 'changed'
    first.milestones[0].measurableLine = 'changed'
    first.goal.weeklyTarget!.sessions = 9

    const second = await getGoal('goal-strong')
    expect(second.goal.label).toBe('Be strong')
    expect(second.milestones[0].measurableLine).not.toBe('changed')
    expect(second.goal.weeklyTarget?.sessions).toBe(3)
  })
})

describe('setWeeklyTarget', () => {
  it('adds a target from this Monday, keeps the earlier one, and returns the goal', async () => {
    const goal = await setWeeklyTarget('goal-strong', countOf(4, 'lifting sessions'))

    expect(goal).toMatchObject({ id: 'goal-strong', status: 'active' })
    expect(goal.weeklyTarget).toEqual({ kind: 'count', sessions: 4, amount: null, unit: 'lifting sessions', effectiveFrom: '2026-11-09' })
    expect(store.weeklyTargets.find((row) => row.goalId === 'goal-strong' && row.effectiveFrom === '2026-10-05')?.sessions).toBe(3)
    expect((await getGoal('goal-strong')).goal).toEqual(goal)
  })

  it('updates this week’s row when changed again the same week', async () => {
    await setWeeklyTarget('goal-strong', countOf(4, 'lifting sessions'))
    await setWeeklyTarget('goal-strong', countOf(2, ' gym visits '))

    const rows = store.weeklyTargets.filter((row) => row.goalId === 'goal-strong')
    expect(rows.map((row) => [row.effectiveFrom, row.sessions, row.unit])).toEqual([
      ['2026-10-05', 3, 'lifting sessions'],
      ['2026-11-09', 2, 'gym visits'],
    ])
  })

  it('gives a goal its first target', async () => {
    await setWeeklyTarget('goal-look-good', countOf(4, 'clean meals'))

    expect((await getGoal('goal-look-good')).goal.weeklyTarget).toMatchObject({ sessions: 4, unit: 'clean meals' })
  })

  it('shows on Week at once', async () => {
    await setWeeklyTarget('goal-strong', countOf(4, 'lifting sessions'))

    const week = await getWeek()
    expect(week.goals.find((goal) => goal.id === 'goal-strong')?.weeklyTarget?.sessions).toBe(4)
  })

  it('takes 1 to 14 sessions, whole, and a unit', async () => {
    await expect(setWeeklyTarget('goal-strong', countOf(14, 'lifting sessions'))).resolves.toBeDefined()
    for (const sessions of [0, 2.5, 15]) {
      await expect(setWeeklyTarget('goal-strong', countOf(sessions, 'lifting sessions'))).rejects.toThrow()
    }
    await expect(setWeeklyTarget('goal-strong', countOf(3, '  '))).rejects.toThrow()
    expect(latestRow('goal-strong')?.sessions).toBe(14)
  })

  it('rejects a goal that is not building, or is reached or ended, and an unknown one', async () => {
    await expect(setWeeklyTarget('goal-garage', countOf(1, 'trips to the dump'))).rejects.toThrow()
    await expect(setWeeklyTarget('goal-5k', countOf(3, 'runs'))).rejects.toThrow()
    await expect(setWeeklyTarget('goal-nope', countOf(3, 'runs'))).rejects.toThrow(NotFoundError)
  })

  function latestRow(goalId: string) {
    return store.weeklyTargets.filter((row) => row.goalId === goalId).at(-1)
  }
})

describe('addMilestone', () => {
  it('adds an upcoming milestone after the goal’s last one, and returns the page', async () => {
    const page = await addMilestone('goal-strong', { measurableLine: ' Bench 172 ', targetDate: '2027-02-01' })

    const added = page.milestones.at(-1)!
    expect(added).toEqual({
      id: added.id,
      position: 6,
      measurableLine: 'Bench 172',
      status: 'upcoming',
      targetDate: '2027-02-01',
      result: null,
    })
    expect(page.progress).toEqual({ hit: 1, of: 7 })
    expect(await getGoal('goal-strong')).toEqual(page)
  })

  it('adds one with no date, and a goal’s first, each with its own id', async () => {
    const first = (await addMilestone('goal-cook', { measurableLine: 'Cook 3 nights a week' })).milestones
    const second = (await addMilestone('goal-cook', { measurableLine: 'Cook 4 nights a week' })).milestones

    expect(first).toHaveLength(1)
    expect(first[0].targetDate).toBeNull()
    expect(second[1].id).not.toBe(second[0].id)
  })

  it('rejects a blank line, a date before the start or past the deadline, a reached goal and an unknown one', async () => {
    const deadline = store.goals.find((goal) => goal.id === 'goal-garage')!.deadline!

    await expect(addMilestone('goal-strong', { measurableLine: '  ' })).rejects.toThrow()
    await expect(addMilestone('goal-strong', { measurableLine: 'Bench 140', targetDate: '2026-10-04' })).rejects.toThrow()
    await expect(addMilestone('goal-strong', { measurableLine: 'Bench 146', targetDate: '2026-10-05' })).resolves.toBeDefined()
    await expect(addMilestone('goal-garage', { measurableLine: 'Paint', targetDate: '2027-06-01' })).rejects.toThrow()
    await expect(addMilestone('goal-garage', { measurableLine: 'Paint', targetDate: deadline })).resolves.toBeDefined()
    await expect(addMilestone('goal-5k', { measurableLine: 'Run 6k' })).rejects.toThrow()
    await expect(addMilestone('goal-nope', { measurableLine: 'Run 6k' })).rejects.toThrow(NotFoundError)
  })
})

describe('checkIn', () => {
  const milestoneById = (id: string) => store.milestones.find((milestone) => milestone.id === id)!
  const goalById = (id: string) => store.goals.find((goal) => goal.id === id)!

  function hitEvery(goalId: string) {
    for (const milestone of store.milestones) if (milestone.goalId === goalId) milestone.status = 'hit'
  }

  it('marks Next hit with the result, returns the page, and the following one is Next', async () => {
    const page = await checkIn('goal-strong', 'ms-strong-2', 'hit', ' Bench 155, squat 305, deadlift 350 ')

    expect(page.milestones[1]).toMatchObject({ status: 'hit', result: 'Bench 155, squat 305, deadlift 350' })
    expect(page.progress).toEqual({ hit: 2, of: 6 })
    expect(page.latest).toEqual({ result: 'Bench 155, squat 305, deadlift 350', checkedInOn: WEDNESDAY_DAY })
    await expect(checkIn('goal-strong', 'ms-strong-3', 'notYet')).resolves.toMatchObject({ milestones: expect.arrayContaining([expect.objectContaining({ id: 'ms-strong-3', status: 'notYet' })]) })
  })

  it('marks not yet, and keeps no blank result', async () => {
    const page = await checkIn('goal-strong', 'ms-strong-2', 'notYet', '   ')

    expect(page.milestones[1]).toMatchObject({ status: 'notYet', result: null })
  })

  // #33: each check-in is its own record, and Latest is the newest with a result.
  it('keeps every check-in, dated today, and moves Latest to the newest with a result', async () => {
    const before = store.checkIns.length

    await checkIn('goal-strong', 'ms-strong-2', 'notYet', 'Bench 153, squat 300, deadlift 340')
    const page = await checkIn('goal-strong', 'ms-strong-2', 'hit')

    expect(store.checkIns.slice(before)).toEqual([
      expect.objectContaining({ goalId: 'goal-strong', milestoneId: 'ms-strong-2', outcome: 'notYet', result: 'Bench 153, squat 300, deadlift 340', checkedInOn: WEDNESDAY_DAY }),
      expect.objectContaining({ goalId: 'goal-strong', milestoneId: 'ms-strong-2', outcome: 'hit', result: null, checkedInOn: WEDNESDAY_DAY }),
    ])
    expect(page.latest).toEqual({ result: 'Bench 153, squat 300, deadlift 340', checkedInOn: WEDNESDAY_DAY })
    expect(page.milestones[1]).toMatchObject({ status: 'hit', result: null })
  })

  it('takes only Next on a building goal, but any step not done on a one-off goal', async () => {
    await expect(checkIn('goal-strong', 'ms-strong-4', 'hit')).rejects.toThrow()
    await expect(checkIn('goal-strong', null, 'hit')).rejects.toThrow()
    expect(milestoneById('ms-strong-4').status).toBe('upcoming')
    expect(goalById('goal-strong').status).toBe('active')

    await expect(checkIn('goal-garage', 'ms-garage-5', 'hit')).resolves.toBeDefined()
    expect(milestoneById('ms-garage-5').status).toBe('hit')
  })

  // The API refuses every check-in on a one-off goal until #31; the mock
  // takes its own line once every step is done, as the screen offers it.
  it("reaches a one-off goal with a hit on its own line once every step is done", async () => {
    await expect(checkIn('goal-garage', null, 'hit')).rejects.toThrow()
    hitEvery('goal-garage')

    await expect(checkIn('goal-garage', null, 'hit')).resolves.toMatchObject({ goal: { status: 'reached' } })
  })

  it("reaches the goal with a hit on its own line once every milestone is hit, keeping the check-in", async () => {
    hitEvery('goal-strong')

    const page = await checkIn('goal-strong', null, 'hit', ' Bench 175, squat 350, deadlift 400 ')

    expect(page.goal).toMatchObject({ status: 'reached', endedOn: WEDNESDAY_DAY })
    expect(page.progress).toEqual({ hit: 6, of: 6 })
    expect(page.latest).toEqual({ result: 'Bench 175, squat 350, deadlift 400', checkedInOn: WEDNESDAY_DAY })
    expect(store.checkIns.at(-1)).toMatchObject({ goalId: 'goal-strong', milestoneId: null, outcome: 'hit' })
  })

  it("keeps a not yet on the goal's own line as Latest, the goal still active", async () => {
    hitEvery('goal-strong')

    const page = await checkIn('goal-strong', null, 'notYet', 'Bench 170, squat 345, deadlift 395')

    expect(page.goal.status).toBe('active')
    expect(page.latest).toEqual({ result: 'Bench 170, squat 345, deadlift 395', checkedInOn: WEDNESDAY_DAY })
    expect(store.checkIns.at(-1)).toMatchObject({ milestoneId: null, outcome: 'notYet' })
  })

  it('rejects a hit milestone, an unknown one, another goal’s, and any on a reached goal', async () => {
    const before = store.checkIns.length
    await expect(checkIn('goal-strong', 'ms-strong-1', 'hit')).rejects.toThrow()
    await expect(checkIn('goal-strong', 'ms-nope', 'hit')).rejects.toThrow(NotFoundError)
    await expect(checkIn('goal-endurance', 'ms-strong-2', 'hit')).rejects.toThrow()
    goalById('goal-strong').status = 'reached'
    await expect(checkIn('goal-strong', 'ms-strong-2', 'hit')).rejects.toThrow()
    expect(store.checkIns).toHaveLength(before)
  })
})

describe('updateMilestone and keepMilestone', () => {
  function datesOf(milestones: { targetDate: string | null }[]) {
    return milestones.map((milestone) => milestone.targetDate)
  }

  const NOT_YET_LINE = 'Bench 155, squat 300, deadlift 345'

  it('keeps the date: back to upcoming, still Next, nothing else moves', async () => {
    const { milestones } = await keepMilestone('ms-strong-2')

    expect(milestones.map((milestone) => milestone.status)).toEqual(['hit', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-06', '2026-11-30', null, null])
    expect(milestones[1].result).toBeNull()
  })

  it('keeping an upcoming milestone changes nothing; a hit one is refused', async () => {
    const before = await getGoal('goal-strong')

    await expect(keepMilestone('ms-strong-3')).resolves.toEqual(before)
    await expect(keepMilestone('ms-strong-1')).rejects.toThrow()
    await expect(keepMilestone('ms-nope')).rejects.toThrow(NotFoundError)
  })

  // #33: the not-yet check-in stays in the history; it's what moved on.
  it('leaves the check-in history alone, whichever way it goes', async () => {
    const history = structuredClone(store.checkIns)

    const page = await updateMilestone('ms-strong-2', { measurableLine: NOT_YET_LINE, targetDate: '2026-11-27' })

    expect(store.checkIns).toEqual(history)
    expect(page.latest).toEqual({ result: 'Bench 152, squat 300, deadlift 340', checkedInOn: '2026-11-06' })
  })

  it('moves a not-yet date three weeks later, back to upcoming, and pushes the next one by three weeks', async () => {
    const { milestones } = await updateMilestone('ms-strong-2', { measurableLine: NOT_YET_LINE, targetDate: '2026-11-27' })

    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-27', '2026-12-21', null, null])
    expect(milestones[1].status).toBe('upcoming')
    expect(datesOf((await getGoal('goal-strong')).milestones)).toEqual(datesOf(milestones))
  })

  it('pushes nothing past the deadline', async () => {
    store.goals.find((goal) => goal.id === 'goal-strong')!.deadline = '2026-12-10'

    const { milestones } = await updateMilestone('ms-strong-2', { measurableLine: NOT_YET_LINE, targetDate: '2026-11-27' })

    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-27', '2026-12-10', null, null])
  })

  it('adjusts the line, trimmed, and takes the date as sent', async () => {
    const { milestones } = await updateMilestone('ms-strong-2', { measurableLine: ' Bench 153, squat 300, deadlift 340 ', targetDate: null })

    expect(milestones[1]).toMatchObject({ measurableLine: 'Bench 153, squat 300, deadlift 340', status: 'upcoming', targetDate: null })
  })

  it('keeps a hit milestone hit when it is edited', async () => {
    const { milestones } = await updateMilestone('ms-strong-1', { measurableLine: 'Bench 150', targetDate: '2026-11-02' })

    expect(milestones[0]).toMatchObject({ measurableLine: 'Bench 150', status: 'hit', result: 'Bench 150, squat 290, deadlift 330' })
  })

  it('rejects a blank line, a date outside the goal, an unknown one and an ended goal', async () => {
    await expect(updateMilestone('ms-strong-2', { measurableLine: '  ', targetDate: null })).rejects.toThrow()
    await expect(updateMilestone('ms-strong-2', { measurableLine: NOT_YET_LINE, targetDate: '2026-10-01' })).rejects.toThrow()
    await expect(updateMilestone('ms-nope', { measurableLine: NOT_YET_LINE, targetDate: null })).rejects.toThrow(NotFoundError)
    expect(store.milestones.find((milestone) => milestone.id === 'ms-strong-2')!.status).toBe('notYet')

    store.goals.find((goal) => goal.id === 'goal-strong')!.status = 'ended'
    await expect(keepMilestone('ms-strong-2')).rejects.toThrow()
    await expect(updateMilestone('ms-strong-2', { measurableLine: NOT_YET_LINE, targetDate: null })).rejects.toThrow()
  })
})

describe('pauseGoal and resumeGoal', () => {
  const task = (id: string) => store.tasks.find((candidate) => candidate.id === id)!
  const goalById = (id: string) => store.goals.find((goal) => goal.id === id)!

  it('pausing sets this week’s waiting tasks aside, keeping their day, and leaves done ones', async () => {
    const paused = await pauseGoal('goal-strong')

    expect(paused.status).toBe('paused')
    expect(task('task-lift-today')).toMatchObject({ setAside: true, plannedDay: WEDNESDAY_DAY })
    expect(whereIs(task('task-lift-bank'))).toBe('setAside')
    expect(whereIs(task('task-lift-mon'))).toBe('done')
    expect(ids((await readDay(WEDNESDAY_DAY)).tasks)).not.toContain('task-lift-today')
    expect(ids((await readBank()).tasks)).not.toContain('task-lift-bank')
    // The week's goals are the active ones (the API's Week), so a paused goal leaves them.
    expect(ids((await getWeek()).goals)).not.toContain('goal-strong')
  })

  it('resuming puts those tasks back in this week’s bank, with no day', async () => {
    await pauseGoal('goal-strong')
    await pauseGoal('goal-endurance')

    const resumed = await resumeGoal('goal-strong')

    expect(resumed.status).toBe('active')
    for (const id of ['task-lift-today', 'task-lift-bank']) {
      expect(whereIs(task(id))).toBe('inBank')
      expect(task(id).plannedDay).toBeNull()
      expect(task(id).placedByHand).toBe(false)
    }
    expect(ids((await readBank()).tasks)).toEqual(expect.arrayContaining(['task-lift-bank', 'task-lift-today']))
    expect(whereIs(task('task-run-bank'))).toBe('setAside')
    expect(whereIs(task('task-lift-mon'))).toBe('done')
  })

  it('resumes a goal whose aspiration is retired, keeping the aspiration', async () => {
    await retireAspiration('asp-fit', 'pause')

    const resumed = await resumeGoal('goal-strong')

    expect(resumed).toMatchObject({ status: 'active', aspirationId: 'asp-fit' })
    expect(ids((await readBank()).tasks)).toContain('task-lift-bank')
  })

  it('returns an active goal unchanged when resumed again', async () => {
    await expect(resumeGoal('goal-strong')).resolves.toMatchObject({ status: 'active' })
  })

  it('rejects pausing a goal that isn’t active, resuming a reached or ended one, and unknown ids', async () => {
    await expect(pauseGoal('goal-cook')).rejects.toThrow()
    await expect(pauseGoal('goal-5k')).rejects.toThrow()
    await expect(resumeGoal('goal-5k')).rejects.toThrow()
    await endGoal('goal-strong')
    await expect(resumeGoal('goal-strong')).rejects.toThrow()
    await expect(pauseGoal('goal-nope')).rejects.toThrow(NotFoundError)
    await expect(resumeGoal('goal-nope')).rejects.toThrow(NotFoundError)
    expect(goalById('goal-5k').status).toBe('reached')
  })
})

describe('endGoal and markGoalReached', () => {
  const task = (id: string) => store.tasks.find((candidate) => candidate.id === id)!

  it('marks it reached today, and moves no tasks', async () => {
    const reached = await markGoalReached('goal-strong')

    expect(reached).toMatchObject({ status: 'reached', endedOn: WEDNESDAY_DAY })
    expect(whereIs(task('task-lift-today'))).toBe('planned')
    expect(whereIs(task('task-lift-bank'))).toBe('inBank')
  })

  it('ends it for now, from active or paused', async () => {
    await expect(endGoal('goal-strong')).resolves.toMatchObject({ status: 'ended', endedOn: WEDNESDAY_DAY })
    await expect(endGoal('goal-cook')).resolves.toMatchObject({ status: 'ended' })
  })

  it('returns the goal unchanged when sent again', async () => {
    await endGoal('goal-strong')
    await expect(endGoal('goal-strong')).resolves.toMatchObject({ status: 'ended', endedOn: WEDNESDAY_DAY })
    await expect(markGoalReached('goal-5k')).resolves.toMatchObject({ status: 'reached' })
  })

  it('rejects ending a reached goal, reaching an ended one, and an unknown one', async () => {
    await expect(endGoal('goal-5k')).rejects.toThrow()
    await endGoal('goal-strong')
    await expect(markGoalReached('goal-strong')).rejects.toThrow()
    await expect(markGoalReached('goal-nope')).rejects.toThrow(NotFoundError)
  })
})

describe('reopenGoal and goAgain', () => {
  const task = (id: string) => store.tasks.find((candidate) => candidate.id === id)!

  it('reopens a reached goal: active again, no end date, its milestones as they were', async () => {
    await markGoalReached('goal-strong')

    const reopened = await reopenGoal('goal-strong')

    expect(reopened).toMatchObject({ status: 'active', endedOn: null })
    expect(store.milestones.find((milestone) => milestone.id === 'ms-strong-2')?.status).toBe('notYet')
  })

  it('goes again: an ended goal active, the end date cleared, its tasks as they were', async () => {
    await endGoal('goal-strong')

    const again = await goAgain('goal-strong')

    expect(again).toMatchObject({ status: 'active', endedOn: null })
    expect(whereIs(task('task-lift-today'))).toBe('planned')
  })

  it('each works only from its own status', async () => {
    await endGoal('goal-strong')
    await expect(reopenGoal('goal-strong')).rejects.toThrow()
    await expect(goAgain('goal-5k')).rejects.toThrow()
    await expect(reopenGoal('goal-cook')).rejects.toThrow()
    await expect(goAgain('goal-cook')).rejects.toThrow()
    await expect(reopenGoal('goal-nope')).rejects.toThrow(NotFoundError)
  })
})

describe('updateAspiration', () => {
  it('changes the name and the why, trimmed', async () => {
    const saved = await updateAspiration('asp-fit', { name: '  Be fit for life ', why: ' To keep skiing. ' })

    expect(saved).toMatchObject({ name: 'Be fit for life', why: 'To keep skiing.' })
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')?.name).toBe('Be fit for life')
  })

  it('removes the why when it is cleared, and leaves what is not given alone', async () => {
    const saved = await updateAspiration('asp-fit', { why: '  ' })

    expect(saved.why).toBeNull()
    expect(saved.name).toBe('Be fit')
  })

  it('rejects an empty name and changes nothing', async () => {
    await expect(updateAspiration('asp-fit', { name: '   ', why: 'New why' })).rejects.toThrow('An aspiration needs a name')
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')?.why).toMatch(/^So I can keep skiing/)
  })

  it('rejects an unknown id', async () => {
    await expect(updateAspiration('asp-nope', { name: 'X' })).rejects.toThrow('No aspiration with id asp-nope')
  })
})

describe('moveAspiration', () => {
  function addActive(id: string, position: number) {
    store.aspirations.push({ id, name: id, why: null, position, status: 'active', createdAt: '2026-11-01T09:00:00Z', retiredOn: null })
  }

  it('moves the first one down, and returns the active ones in order', async () => {
    const order = await moveAspiration('asp-fit', 'down')

    expect(order.map((aspiration) => [aspiration.id, aspiration.position])).toEqual([
      ['asp-home', 1],
      ['asp-fit', 2],
    ])
  })

  it('moves the last one up', async () => {
    const order = await moveAspiration('asp-home', 'up')

    expect(order.map((aspiration) => aspiration.id)).toEqual(['asp-home', 'asp-fit'])
  })

  it('moves one in the middle either way, touching only its neighbour', async () => {
    addActive('asp-build', 3)

    const up = await moveAspiration('asp-home', 'up')
    expect(up.map((aspiration) => aspiration.id)).toEqual(['asp-home', 'asp-fit', 'asp-build'])

    const down = await moveAspiration('asp-fit', 'down')
    expect(down.map((aspiration) => [aspiration.id, aspiration.position])).toEqual([
      ['asp-home', 1],
      ['asp-build', 2],
      ['asp-fit', 3],
    ])
  })

  it('rejects moving the first up or the last down', async () => {
    await expect(moveAspiration('asp-fit', 'up')).rejects.toThrow('asp-fit is already first')
    await expect(moveAspiration('asp-home', 'down')).rejects.toThrow('asp-home is already last')
  })

  it('rejects moving a retired aspiration or an unknown id', async () => {
    await expect(moveAspiration('asp-spanish', 'up')).rejects.toThrow('asp-spanish is retired')
    await expect(moveAspiration('asp-nope', 'up')).rejects.toThrow('No aspiration with id asp-nope')
  })
})

describe('retireAspiration', () => {
  const goalStatus = (id: string) => store.goals.find((goal) => goal.id === id)?.status
  const taskStatus = (id: string) => {
    const task = store.tasks.find((candidate) => candidate.id === id)
    return task && whereIs(task)
  }

  function addStretchOnThursday() {
    store.tasks.push(
      aStoredTask('task-stretch-thu', {
        title: 'Stretch',
        plannedDay: '2026-11-12',
        recurringItemId: 'rec-stretch',
        placedByHand: true,
      }),
    )
  }

  it('retires it with the day, takes away its priority and moves the ones below up', async () => {
    const saved = await retireAspiration('asp-fit', 'pause')

    expect(saved).toMatchObject({ status: 'retired', retiredOn: '2026-11-11' })
    expect(saved.position).toBeNull()
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-home')?.position).toBe(1)
  })

  it('with pause, pauses its active goals and turns off its recurring items', async () => {
    await retireAspiration('asp-fit', 'pause')

    expect(['goal-strong', 'goal-endurance', 'goal-look-good'].map(goalStatus)).toEqual(['paused', 'paused', 'paused'])
    expect(goalStatus('goal-5k')).toBe('reached')
    expect(store.goals.filter((goal) => goal.aspirationId === 'asp-fit')).toHaveLength(4)
    expect(store.recurringItems.filter((item) => item.aspirationId === 'asp-fit').map((item) => item.active)).toEqual([
      false,
      false,
    ])
  })

  it("with pause, sets aside this week's not-done tasks, hand-placed ones too, keeping their day", async () => {
    addStretchOnThursday()

    await retireAspiration('asp-fit', 'pause')

    expect(['task-lift-today', 'task-lift-bank', 'task-run-bank', 'task-stretch-thu'].map(taskStatus)).toEqual([
      'setAside',
      'setAside',
      'setAside',
      'setAside',
    ])
    expect(store.tasks.find((task) => task.id === 'task-stretch-thu')?.plannedDay).toBe('2026-11-12')
    expect(['task-lift-mon', 'task-run-mon'].map(taskStatus)).toEqual(['done', 'done'])
    expect(['task-laundry', 'task-donate-bikes'].map(taskStatus)).toEqual(['planned', 'planned'])
  })

  it("with pause, leaves its goals' tasks in other weeks alone", async () => {
    store.tasks.push(
      aStoredTask('task-lift-next-week', { title: 'Lift: squat day', week: '2026-11-16', goalId: 'goal-strong' }),
    )

    await retireAspiration('asp-fit', 'pause')

    expect(taskStatus('task-lift-next-week')).toBe('inBank')
  })

  it('with pause, leaves its tasks off every day, the bank, Week and Keep life running', async () => {
    addStretchOnThursday()

    await retireAspiration('asp-fit', 'pause')

    expect(ids((await readDay(WEDNESDAY_DAY)).tasks)).not.toContain('task-lift-today')
    expect(ids((await readDay('2026-11-12')).tasks)).not.toContain('task-stretch-thu')
    expect(ids((await readBank()).tasks)).toEqual(['task-dentist', 'task-garage-shelves'])
    const week = await getWeek()
    expect(week.goals).toEqual([])
    expect(week.tasks.filter((task) => task.state === 'open').map((task) => task.goalId)).not.toContain(
      'goal-strong',
    )
    expect(ids((await getUpkeep()).tasks)).not.toContain('task-stretch-thu')
  })

  it('with keep, its goals and recurring items carry on with no aspiration', async () => {
    store.goals.find((goal) => goal.id === 'goal-look-good')!.status = 'paused'

    await retireAspiration('asp-fit', 'keep')

    const kept = store.goals.filter((goal) => ['goal-strong', 'goal-endurance', 'goal-look-good'].includes(goal.id))
    expect(kept.map((goal) => [goal.status, goal.aspirationId])).toEqual([
      ['active', null],
      ['active', null],
      ['paused', null],
    ])
    expect(store.goals.find((goal) => goal.id === 'goal-5k')?.aspirationId).toBe('asp-fit')
    const items = store.recurringItems.filter((item) => ['rec-stretch', 'rec-hockey'].includes(item.id))
    expect(items.map((item) => [item.active, item.aspirationId])).toEqual([
      [true, null],
      [true, null],
    ])
    expect(taskStatus('task-lift-today')).toBe('planned')
  })

  it('rejects retiring a retired aspiration or an unknown id, changing nothing', async () => {
    await expect(retireAspiration('asp-spanish', 'pause')).rejects.toThrow('asp-spanish is retired')
    await expect(retireAspiration('asp-nope', 'pause')).rejects.toThrow('No aspiration with id asp-nope')
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-spanish')?.retiredOn).toBe('2026-09-15')
  })
})

describe('bringBackAspiration', () => {
  it('makes a retired aspiration active again, last in priority', async () => {
    const saved = await bringBackAspiration('asp-spanish')

    expect(saved).toMatchObject({ status: 'active', position: 3 })
    expect(saved.retiredOn).toBeNull()
  })

  it('leaves its paused goals paused', async () => {
    store.goals.find((goal) => goal.id === 'goal-spanish-a2')!.status = 'paused'

    await bringBackAspiration('asp-spanish')

    expect(store.goals.find((goal) => goal.id === 'goal-spanish-a2')?.status).toBe('paused')
  })

  it('rejects an active aspiration or an unknown id', async () => {
    await expect(bringBackAspiration('asp-fit')).rejects.toThrow('asp-fit is not retired')
    await expect(bringBackAspiration('asp-nope')).rejects.toThrow('No aspiration with id asp-nope')
  })
})

describe('getUpkeep', () => {
  it('returns the active recurring items with no aspiration', async () => {
    expect(ids((await getUpkeep()).recurringItems)).toEqual(['rec-rent'])

    store.recurringItems.find((item) => item.id === 'rec-rent')!.active = false

    expect((await getUpkeep()).recurringItems).toEqual([])
  })

  it('returns tasks with no goal and no recurring item that are still to do', async () => {
    const { tasks } = await getUpkeep()

    expect(ids(tasks)).toEqual([
      'task-backup',
      'task-ballot',
      'task-bathroom',
      'task-dentist',
      'task-dentist-appt',
      'task-dry-cleaning',
      'task-groceries',
      'task-lease',
      'task-library',
      'task-meal-prep',
      'task-move-car',
      'task-plants',
      'task-plumber',
    ])
  })

  it('leaves out goal tasks, recurring tasks and done tasks', async () => {
    const taskIds = ids((await getUpkeep()).tasks)

    expect(taskIds).not.toContain('task-lift-today')
    expect(taskIds).not.toContain('task-laundry')
    expect(taskIds).not.toContain('task-plan-mon')

    await checkOffTask('task-ballot', TAPPED)

    expect(ids((await getUpkeep()).tasks)).not.toContain('task-ballot')
  })

  it('includes later weeks and leaves out earlier ones', async () => {
    const loose = { title: 'Renew the insurance' }
    store.tasks.push(
      aStoredTask('task-next-week', { ...loose, week: '2026-11-16' }),
      aStoredTask('task-last-week', { ...loose, week: '2026-11-02' }),
    )

    const taskIds = ids((await getUpkeep()).tasks)

    expect(taskIds).toContain('task-next-week')
    expect(taskIds).not.toContain('task-last-week')
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getUpkeep()
    first.tasks[0].title = 'changed'
    first.recurringItems[0].name = 'changed'

    const second = await getUpkeep()
    expect(second.tasks[0].title).not.toBe('changed')
    expect(second.recurringItems[0].name).toBe('Pay rent')
  })
})

// The dataset checks from mockData.test.ts that hold for added records.
function expectConsistentStore() {
  const all = [...store.aspirations, ...store.goals, ...store.milestones, ...store.recurringItems, ...store.tasks]
  expect(new Set(all.map((record) => record.id)).size).toBe(all.length)
  const goalIds = new Set(store.goals.map((goal) => goal.id))
  const aspirationIds = new Set(store.aspirations.map((aspiration) => aspiration.id))
  for (const task of store.tasks) {
    if (task.goalId) expect(goalIds).toContain(task.goalId)
  }
  for (const goal of store.goals) if (goal.aspirationId) expect(aspirationIds).toContain(goal.aspirationId)
  for (const target of store.weeklyTargets) expect(goalIds).toContain(target.goalId)
  const priorities = store.aspirations.filter((a) => a.status === 'active').map((a) => a.position).sort()
  expect(priorities).toEqual(priorities.map((_, index) => index + 1))
}

describe('addTask', () => {
  it('gives the task an id made on the device', async () => {
    expect((await addTask({ title: 'Fill out my ballot' })).id).toMatch(UUID_V4)
  })

  it("stores a task with only a title in this week's bank", async () => {
    const task = await addTask({ title: '  Fill out my ballot  ' })

    expect(task).toMatchObject({ title: 'Fill out my ballot', plannedDay: null, week: '2026-11-09', carriedOver: 0 })
    expect(task.plannedDay).toBeNull()
    expect(task.placedByHand).toBe(false)
    expect(ids((await readBank()).tasks)).toContain(task.id)
    expectConsistentStore()
  })

  it('keeps the goal, due date and time of day', async () => {
    const task = await addTask({
      title: 'Book a gym class',
      goalId: 'goal-strong',
      dueDate: '2026-11-13',
      timeOfDay: { kind: 'by', time: '18:00' },
    })

    expect(task).toMatchObject({ goalId: 'goal-strong', dueDate: '2026-11-13', timeOfDay: { kind: 'by', time: '18:00' } })
    expect((await readBank()).tasks.find((row) => row.id === task.id)?.goalLabel).toBe('Be strong')
  })

  it("leaves a task due next week out of this week's bank and week", async () => {
    const task = await addTask({ title: 'Renew passport', dueDate: '2026-11-18' })

    expect(task).toMatchObject({ plannedDay: null, week: '2026-11-16' })
    expect(ids((await readBank()).tasks)).not.toContain(task.id)
    expect(ids((await getWeek()).tasks)).not.toContain(task.id)
    expectConsistentStore()
  })

  it('puts a task due across the year end in that week', async () => {
    const task = await addTask({ title: 'File taxes', dueDate: '2027-01-02' })

    expect(task.week).toBe('2026-12-28')
    expect(ids((await readBank()).tasks)).not.toContain(task.id)
  })

  it('puts a task on today, placed by hand, whatever its due date', async () => {
    const task = await addTask({ title: 'Call the vet', dueDate: '2026-11-25', day: WEDNESDAY_DAY })

    expect(task).toMatchObject({ plannedDay: WEDNESDAY_DAY, week: '2026-11-09', placedByHand: true })
    const today = (await readDay(WEDNESDAY_DAY)).tasks.find((row) => row.id === task.id)
    expect(today?.placedByHand).toBe(true)
    expect(ids((await readBank()).tasks)).not.toContain(task.id)
    expectConsistentStore()
  })

  it("saves a task sent for a day that's passed in this week's bank, as the API does", async () => {
    const task = await addTask({ title: 'Call the vet', day: '2026-11-10' })

    expect(task).toMatchObject({ plannedDay: null, week: '2026-11-09', placedByHand: false })
  })

  it('puts a task on a later day of the week when sent one', async () => {
    const task = await addTask({ title: 'Call the vet', day: '2026-11-13' })

    expect(task).toMatchObject({ plannedDay: '2026-11-13', week: '2026-11-09', placedByHand: true })
  })

  it('gives each new task its own id', async () => {
    const first = await addTask({ title: 'One' })
    const second = await addTask({ title: 'Two' })

    expect(first.id).not.toBe(second.id)
    expectConsistentStore()
  })

  it('returns a copy, so changing it does not change the store', async () => {
    const task = await addTask({ title: 'Water the plants' })
    task.title = 'changed'

    expect((await readBank()).tasks.find((row) => row.id === task.id)?.title).toBe('Water the plants')
  })

  it('rejects a blank title and stores nothing', async () => {
    const before = store.tasks.length

    await expect(addTask({ title: '   ' })).rejects.toThrow()
    expect(store.tasks).toHaveLength(before)
  })

  it('rejects an unknown goal and stores nothing', async () => {
    const before = store.tasks.length

    await expect(addTask({ title: 'Lift', goalId: 'goal-nope' })).rejects.toBeInstanceOf(NotFoundError)
    expect(store.tasks).toHaveLength(before)
  })

  it.each(['paused', 'reached', 'ended'] as const)('rejects a %s goal and stores nothing', async (status) => {
    store.goals.find((goal) => goal.id === 'goal-strong')!.status = status
    const before = store.tasks.length

    await expect(addTask({ title: 'Lift', goalId: 'goal-strong' })).rejects.toThrow()
    expect(store.tasks).toHaveLength(before)
  })
})

describe('createGoal', () => {
  const BE_STRONG_2 = { label: 'Be strong 2', measurableLine: 'bench 185', type: 'building' as const, aspirationId: 'asp-fit' }

  it('stores an active goal starting today, with what was given', async () => {
    const goal = await createGoal({ ...BE_STRONG_2, label: '  Be strong 2 ', measurableLine: ' bench 185 ', baseline: ' bench 165 ' })

    expect(goal).toMatchObject({
      label: 'Be strong 2',
      measurableLine: 'bench 185',
      type: 'building',
      status: 'active',
      startDate: WEDNESDAY_DAY,
      aspirationId: 'asp-fit',
      baseline: 'bench 165',
    })
    expect(goal.deadline).toBeNull()
    expect((await getGoal(goal.id)).goal).toEqual(goal)
    expectConsistentStore()
  })

  it("shows a weekly target in this week's targets, with that many bank tasks titled with the label", async () => {
    const goal = await createGoal({ ...BE_STRONG_2, weeklyTarget: countOf(3, ' lifting sessions ') })

    const week = await getWeek()
    expect(week.goals.find((candidate) => candidate.id === goal.id)?.weeklyTarget).toMatchObject({
      sessions: 3,
      unit: 'lifting sessions',
      effectiveFrom: '2026-11-09',
    })
    const tasks = week.tasks.filter((task) => task.goalId === goal.id)
    expect(tasks).toHaveLength(3)
    expect(tasks.every((task) => task.title === 'Be strong 2' && whereIs(task) === 'inBank' && task.carriedOver === 0)).toBe(true)
    expect(new Set(tasks.map((task) => task.id)).size).toBe(3)
    expect(ids((await readBank()).tasks)).toEqual(expect.arrayContaining(ids(tasks)))
    expectConsistentStore()
  })

  it('keeps a target of up to 14, but adds at most seven tasks, one a day', async () => {
    const goal = await createGoal({ ...BE_STRONG_2, weeklyTarget: countOf(14, 'pushups sets') })

    expect(goal.weeklyTarget?.sessions).toBe(14)
    expect(store.tasks.filter((task) => task.goalId === goal.id)).toHaveLength(7)
  })

  it('adds no target or tasks without a weekly target', async () => {
    const before = store.tasks.length
    const goal = await createGoal(BE_STRONG_2)

    expect(store.weeklyTargets.some((target) => target.goalId === goal.id)).toBe(false)
    expect(store.tasks).toHaveLength(before)
  })

  it('starts a quitting goal today when no start date is given', async () => {
    const goal = await createGoal({ label: 'Quit sugar', measurableLine: '30 days', type: 'quitting' })

    expect(goal.startDate).toBe(WEDNESDAY_DAY)
  })

  it('keeps a start date and deadline', async () => {
    const goal = await createGoal({ label: 'Quit sugar', measurableLine: '30 days', type: 'quitting', startDate: '2026-11-16', deadline: '2026-12-16' })

    expect(goal).toMatchObject({ startDate: '2026-11-16', deadline: '2026-12-16' })
    expect(goal.aspirationId).toBeNull()
  })

  it('accepts a deadline on the start date', async () => {
    await expect(createGoal({ ...BE_STRONG_2, deadline: WEDNESDAY_DAY })).resolves.toMatchObject({ deadline: WEDNESDAY_DAY })
  })

  it('returns a copy, so changing it does not change the store', async () => {
    const goal = await createGoal(BE_STRONG_2)
    goal.label = 'changed'

    expect((await getGoal(goal.id)).goal.label).toBe('Be strong 2')
  })

  it.each([
    ['a blank label', { label: '  ' }, Error],
    ['a blank measurable line', { measurableLine: '  ' }, Error],
    ['a deadline before the start', { deadline: '2026-11-10' }, Error],
    ['a quitting deadline before its start date', { type: 'quitting' as const, startDate: '2026-11-20', deadline: '2026-11-19' }, Error],
    ['a target of zero', { weeklyTarget: countOf(0, 'sessions') }, Error],
    ['a fractional target', { weeklyTarget: countOf(2.5, 'sessions') }, Error],
    ['a target above 14', { weeklyTarget: countOf(15, 'sessions') }, Error],
    ['a target without a unit', { weeklyTarget: countOf(3, '  ') }, Error],
    ['a target on a one-off goal', { type: 'oneOff' as const, weeklyTarget: countOf(3, 'sessions') }, Error],
    ['a target on a quitting goal', { type: 'quitting' as const, weeklyTarget: countOf(3, 'sessions') }, Error],
    ['an unknown aspiration', { aspirationId: 'asp-nope', weeklyTarget: countOf(3, 'sessions') }, NotFoundError],
    ['a retired aspiration', { aspirationId: 'asp-spanish', weeklyTarget: countOf(3, 'sessions') }, Error],
  ])('rejects %s and stores nothing', async (_, changes, error) => {
    const before = structuredClone({ goals: store.goals, tasks: store.tasks, weeklyTargets: store.weeklyTargets })

    await expect(createGoal({ ...BE_STRONG_2, ...changes })).rejects.toBeInstanceOf(error)
    expect({ goals: store.goals, tasks: store.tasks, weeklyTargets: store.weeklyTargets }).toEqual(before)
  })
})

describe('addAspiration', () => {
  it('stores an active aspiration last of the active ones', async () => {
    const aspiration = await addAspiration({ name: '  Be generous ', why: ' So the people I love feel it ' })

    expect(aspiration).toMatchObject({ name: 'Be generous', why: 'So the people I love feel it', status: 'active', position: 3 })
    expect(Number.isNaN(Date.parse(aspiration.createdAt))).toBe(false)
    expect(aspiration.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const { aspirations } = await getAspirations()
    expect(aspirations.find((row) => row.id === aspiration.id)).toEqual(aspiration)
    expectConsistentStore()
  })

  it('stores one without a why', async () => {
    const aspiration = await addAspiration({ name: 'Be generous', why: '   ' })

    expect(aspiration.why).toBeNull()
    expect((await addAspiration({ name: 'Read more' })).position).toBe(4)
    expectConsistentStore()
  })

  it('can take a goal straight away', async () => {
    const aspiration = await addAspiration({ name: 'Be generous' })

    await expect(createGoal({ label: 'Give', measurableLine: '1% a month', type: 'building', aspirationId: aspiration.id })).resolves.toMatchObject({
      aspirationId: aspiration.id,
    })
  })

  it('rejects a blank name and stores nothing', async () => {
    const before = store.aspirations.length

    await expect(addAspiration({ name: '   ' })).rejects.toThrow()
    expect(store.aspirations).toHaveLength(before)
  })
})

describe('addRecurringItem', () => {
  const trash: NewRecurringItem = { name: '  Water the plants ', schedule: { kind: 'weekly', weekday: 'tuesday' }, startsOn: WEDNESDAY_DAY }

  it('gives the item an id made on the device', async () => {
    expect((await addRecurringItem(trash)).id).toMatch(UUID_V4)
  })

  it('stores an active item with no aspiration, on Keep life running', async () => {
    const item = await addRecurringItem(trash)

    expect(item).toEqual({
      id: item.id,
      name: 'Water the plants',
      aspirationId: null,
      fromGoalId: null,
      schedule: { kind: 'weekly', weekday: 'tuesday' },
      startsOn: WEDNESDAY_DAY,
      active: true,
      createdAt: item.createdAt,
    })
    const { recurringItems } = await getUpkeep()
    expect(recurringItems.find((row) => row.id === item.id)).toEqual(item)
    expectConsistentStore()
  })

  it('stores one under an aspiration, on its page', async () => {
    const item = await addRecurringItem({ name: 'Stretch more', schedule: { kind: 'flexible', times: 3, period: 'week' }, startsOn: WEDNESDAY_DAY, aspirationId: 'asp-fit' })

    expect(item).toMatchObject({ aspirationId: 'asp-fit', active: true })
    const { recurringItems } = await getAspiration('asp-fit')
    expect(recurringItems.find((row) => row.id === item.id)).toEqual(item)
    expect((await getUpkeep()).recurringItems.map((row) => row.id)).not.toContain(item.id)
    expectConsistentStore()
  })

  it.each([
    ['a blank name', { ...trash, name: '   ' }],
    ['an unknown aspiration', { ...trash, aspirationId: 'asp-nope' }],
    ['a retired aspiration', { ...trash, aspirationId: 'asp-spanish' }],
  ])('rejects %s and stores nothing', async (_case, item) => {
    const before = store.recurringItems.length

    await expect(addRecurringItem(item)).rejects.toThrow()
    expect(store.recurringItems).toHaveLength(before)
  })
})

describe('getSettings', () => {
  it('starts at Normal, as the API has it: intensity only', async () => {
    expect(await getSettings()).toEqual({ intensity: 'normal' })
  })

  it('returns a copy', async () => {
    const settings = await getSettings()
    settings.intensity = 'goingHard'

    expect(store.settings.intensity).toBe('normal')
  })
})

describe('setIntensity', () => {
  it('sets the intensity, and the next getSettings agrees', async () => {
    const settings = await setIntensity('goingHard')

    expect(settings).toEqual({ intensity: 'goingHard' })
    expect(await getSettings()).toEqual(settings)
  })

  it('returns a copy', async () => {
    const settings = await setIntensity('easingOff')
    settings.intensity = 'normal'

    expect(store.settings.intensity).toBe('easingOff')
  })

  it('rejects an unknown intensity and changes nothing', async () => {
    await expect(setIntensity('flatOut' as never)).rejects.toThrow()
    expect(store.settings).toEqual({ intensity: 'normal' })
  })
})

describe('the mock or real switch', () => {
  const fetchMock = vi.fn<typeof fetch>()

  // Each list empty, and anything else answered with an empty object.
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url) => {
      const lists: Record<string, unknown> = {
        '/api/aspirations': { aspirations: [] },
        '/api/goals': { goals: [] },
        '/api/recurring-items': { recurringItems: [] },
      }
      const week = { isCurrent: true, goals: [] }
      return new Response(JSON.stringify(String(url).startsWith('/api/weeks/') ? week : (lists[String(url)] ?? {})), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  function paths() {
    return fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url).replace(/[0-9a-f-]{36}/, '{id}')}`)
  }

  it('keeps everything on the mock with VITE_API=mock, as in every test', async () => {
    await getAspirations()
    await getGoal('goal-strong')
    await getWeek()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the aspiration, goal, settings and Add-sheet choice functions to the API with VITE_API=real', async () => {
    vi.stubEnv('VITE_API', 'real')
    vi.resetModules()
    const client = await import('./client.ts')

    expect(await client.getAspirations()).toMatchObject({ aspirations: [], goals: [] })
    await client.getAspiration('a1').catch(() => {})
    await client.getGoal('g1')
    await client.createGoal({ label: 'Be strong', measurableLine: 'Bench 175', type: 'building' })
    await client.setWeeklyTarget('g1', countOf(3, 'lifting sessions'))
    await client.addMilestone('g1', { measurableLine: 'Bench 172' })
    await client.updateMilestone('m1', { measurableLine: 'Bench 172', targetDate: null })
    await client.keepMilestone('m1')
    await client.checkIn('g1', null, 'hit')
    for (const change of [client.pauseGoal, client.resumeGoal, client.endGoal, client.markGoalReached, client.reopenGoal, client.goAgain]) {
      await change('g1')
    }
    await client.getSettings()
    await client.setIntensity('goingHard')
    await client.getChoices()

    // The four reads behind each aspiration screen go out together, in any order; the Add
    // sheet's choices read two of them.
    expect(paths()).toHaveLength(25)
    expect(paths()).toEqual(
      expect.arrayContaining([
        'GET /api/aspirations',
        'GET /api/goals',
        'GET /api/recurring-items',
        'GET /api/goals/g1',
        'PUT /api/goals/{id}',
        'PUT /api/goals/g1/weekly-target',
        'PUT /api/milestones/{id}',
        'PATCH /api/milestones/m1',
        'POST /api/milestones/m1/keep',
        'PUT /api/check-ins/{id}',
        'POST /api/goals/g1/pause',
        'POST /api/goals/g1/resume',
        'POST /api/goals/g1/end',
        'POST /api/goals/g1/mark-reached',
        'POST /api/goals/g1/reopen',
        'POST /api/goals/g1/go-again',
        'GET /api/settings',
        'PUT /api/settings/intensity',
      ]),
    )
  })

  it('sends the week and what the person does to its tasks to the API with VITE_API=real', async () => {
    vi.stubEnv('VITE_API', 'real')
    vi.resetModules()
    const client = await import('./client.ts')
    const week = '2026-11-09'

    await client.getWeek(week)
    await client.addTask({ title: 'Call the vet', day: '2026-11-11' })
    await client.checkOffTask('t1', { completedAt: '2026-11-11T16:00:00.000Z', completedOn: '2026-11-11', valueLogged: null })
    await client.uncheckTask('t1')
    await client.moveTaskToBank('t1', week)
    await client.placeTask('t1', week, '2026-11-12')
    await client.swapTasks('t1', { week, bankTaskId: 't2', day: '2026-11-12' })
    await client.answerStillMatters('t1', { answer: 'keep' })
    await client.wrapUpWeek(week)
    await client.addRecurringItem({ name: 'Water the plants', schedule: { kind: 'weekly', weekday: 'thursday' }, startsOn: '2026-11-12' })

    expect(paths()).toEqual([
      'GET /api/weeks/2026-11-09',
      'PUT /api/tasks/{id}',
      'POST /api/tasks/t1/check-off',
      'POST /api/tasks/t1/uncheck',
      'POST /api/tasks/t1/bank',
      'POST /api/tasks/t1/place',
      'POST /api/tasks/t1/swap',
      'POST /api/tasks/t1/still-matters',
      'POST /api/weeks/2026-11-09/wrap-up',
      'PUT /api/recurring-items/{id}',
    ])
  })
})
