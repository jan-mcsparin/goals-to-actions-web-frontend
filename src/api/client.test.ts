import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addMilestone,
  bringBackAspiration,
  checkInMilestone,
  checkOffTask,
  endGoal,
  getAspiration,
  getAspirations,
  getBank,
  getDay,
  getGoal,
  getUpkeep,
  getWeek,
  moveAspiration,
  NotFoundError,
  pauseGoal,
  pullFromBank,
  reopenMilestone,
  resumeGoal,
  retireAspiration,
  setWeeklyTarget,
  skipTask,
  swapTask,
  uncheckTask,
  updateAspiration,
} from './client.ts'
import { resetStore, store } from './mockStore.ts'

// Wednesday 11 Nov 2026, 9 a.m. local time.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)
const WEDNESDAY_DAY = '2026-11-11'

function ids(records: { id: string }[]) {
  return records.map((record) => record.id).sort()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(WEDNESDAY)
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getDay', () => {
  it("returns only tasks planned for today's date", async () => {
    const plan = await getDay(WEDNESDAY_DAY)

    expect(plan.date).toBe('2026-11-11')
    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.tasks.every((task) => task.plannedDay === '2026-11-11')).toBe(true)
  })

  it('includes a mix of timed, untimed, goal, maintenance and unlinked tasks', async () => {
    const { tasks } = await getDay(WEDNESDAY_DAY)

    expect(tasks.some((task) => task.timeOfDay?.kind === 'by')).toBe(true)
    expect(tasks.some((task) => task.timeOfDay?.kind === 'at')).toBe(true)
    expect(tasks.some((task) => !task.timeOfDay)).toBe(true)
    expect(tasks.some((task) => task.goalId)).toBe(true)
    expect(tasks.some((task) => task.recurringItemId)).toBe(true)
    expect(tasks.some((task) => !task.goalId && !task.recurringItemId)).toBe(true)
  })

  it('returns exactly the goals, recurring items and aspirations the tasks reference', async () => {
    const plan = await getDay(WEDNESDAY_DAY)

    const goalIds = new Set(plan.tasks.flatMap((task) => task.goalId ?? []))
    const recurringIds = new Set(plan.tasks.flatMap((task) => task.recurringItemId ?? []))
    const aspirationIds = new Set([
      ...plan.goals.flatMap((goal) => goal.aspirationId ?? []),
      ...plan.recurringItems.flatMap((item) => item.aspirationId ?? []),
    ])

    expect(ids(plan.goals)).toEqual([...goalIds].sort())
    expect(ids(plan.recurringItems)).toEqual([...recurringIds].sort())
    expect(ids(plan.aspirations)).toEqual([...aspirationIds].sort())
  })

  it('returns the tasks of whichever day is asked for', async () => {
    const plan = await getDay('2026-11-10')

    expect(plan.date).toBe('2026-11-10')
    expect(plan.tasks.map((task) => task.id)).toEqual(['task-trash'])
    expect(ids(plan.recurringItems)).toEqual(['rec-trash'])
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getDay(WEDNESDAY_DAY)
    first.tasks[0].title = 'changed'
    first.goals[0].label = 'changed'

    const second = await getDay(WEDNESDAY_DAY)
    expect(second.tasks[0].title).not.toBe('changed')
    expect(second.goals[0].label).not.toBe('changed')
  })
})

describe('checkOffTask', () => {
  it('marks the task done with a completion time and returns it', async () => {
    const task = await checkOffTask('task-lift-today')

    expect(task.status).toBe('done')
    expect(task.completedAt).toBe(WEDNESDAY.toISOString())
  })

  it('stores a logged value when given', async () => {
    const task = await checkOffTask('task-lift-today', 155)

    expect(task.valueLogged).toBe(155)
  })

  it('is reflected in the next getDay', async () => {
    await checkOffTask('task-laundry')

    const { tasks } = await getDay(WEDNESDAY_DAY)
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('done')
  })

  it('is undone by resetStore', async () => {
    await checkOffTask('task-laundry')
    resetStore()

    const { tasks } = await getDay(WEDNESDAY_DAY)
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(checkOffTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('returns a copy, so changing it does not change the store', async () => {
    const task = await checkOffTask('task-laundry')
    task.status = 'skipped'

    const { tasks } = await getDay(WEDNESDAY_DAY)
    expect(tasks.find((t) => t.id === 'task-laundry')?.status).toBe('done')
  })
})

describe('uncheckTask', () => {
  it('puts a done task back to planned and clears what check-off set', async () => {
    await checkOffTask('task-lift-today', 155)

    const task = await uncheckTask('task-lift-today')

    expect(task.status).toBe('planned')
    expect(task.completedAt).toBeUndefined()
    expect(task.valueLogged).toBeUndefined()
  })

  it('is reflected in the next getDay', async () => {
    await checkOffTask('task-laundry')
    await uncheckTask('task-laundry')

    const { tasks } = await getDay(WEDNESDAY_DAY)
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(uncheckTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not done', async () => {
    await expect(uncheckTask('task-laundry')).rejects.toThrow('not done')
  })
})

function statusIn(tasks: { id: string; status: string }[], taskId: string) {
  return tasks.find((task) => task.id === taskId)?.status
}

describe('getBank', () => {
  it("returns this week's bank tasks with the records they reference", async () => {
    const bank = await getBank()

    expect(bank.weekOf).toBe('2026-11-09')
    expect(ids(bank.tasks)).toEqual(['task-dentist', 'task-garage-shelves', 'task-lift-bank', 'task-run-bank'])
    expect(ids(bank.goals)).toEqual(['goal-endurance', 'goal-garage', 'goal-strong'])
    expect(ids(bank.aspirations)).toEqual(['asp-fit', 'asp-home'])
    expect(bank.recurringItems).toEqual([])
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getBank()
    first.tasks[0].title = 'changed'

    expect((await getBank()).tasks[0].title).not.toBe('changed')
  })
})

describe('skipTask', () => {
  it('sends a planned task back to the bank without counting a rollover', async () => {
    const task = await skipTask('task-laundry')

    expect(task.status).toBe('inBank')
    expect(task.plannedDay).toBeUndefined()
    expect(task.rolloverCount).toBe(0)
  })

  it('is reflected in the next getDay and getBank', async () => {
    await skipTask('task-laundry')

    expect(statusIn((await getDay(WEDNESDAY_DAY)).tasks, 'task-laundry')).toBeUndefined()
    expect(statusIn((await getBank()).tasks, 'task-laundry')).toBe('inBank')
  })

  it('rejects an unknown task id', async () => {
    await expect(skipTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not planned', async () => {
    await checkOffTask('task-laundry')

    await expect(skipTask('task-laundry')).rejects.toThrow('not planned')
    await expect(skipTask('task-lift-bank')).rejects.toThrow('not planned')
  })
})

describe('pullFromBank', () => {
  it('plans a bank task for today', async () => {
    const task = await pullFromBank('task-lift-bank')

    expect(task.status).toBe('planned')
    expect(task.plannedDay).toBe('2026-11-11')
  })

  it('is reflected in the next getDay and getBank', async () => {
    await pullFromBank('task-lift-bank')

    expect(statusIn((await getDay(WEDNESDAY_DAY)).tasks, 'task-lift-bank')).toBe('planned')
    expect(statusIn((await getBank()).tasks, 'task-lift-bank')).toBeUndefined()
  })

  it('rejects an unknown task id', async () => {
    await expect(pullFromBank('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not in the bank', async () => {
    await expect(pullFromBank('task-laundry')).rejects.toThrow('not in the bank')
  })
})

describe('swapTask', () => {
  it('sends one task to the bank and plans the other for today, each keeping its own time', async () => {
    const { skipped, placed } = await swapTask('task-lift-today', 'task-lift-bank')

    expect(skipped).toMatchObject({ id: 'task-lift-today', status: 'inBank', timeOfDay: { kind: 'at', time: '18:00' } })
    expect(skipped.plannedDay).toBeUndefined()
    expect(placed).toMatchObject({ id: 'task-lift-bank', status: 'planned', plannedDay: '2026-11-11' })
    expect(placed.timeOfDay).toBeUndefined()
  })

  it.each([
    ['no-such-task', 'task-lift-bank'],
    ['task-lift-today', 'no-such-task'],
    ['task-lift-today', 'task-laundry'],
  ])('changes nothing when either side is invalid (%s, %s)', async (taskId, bankTaskId) => {
    const before = await getDay(WEDNESDAY_DAY)

    await expect(swapTask(taskId, bankTaskId)).rejects.toThrow()

    expect(await getDay(WEDNESDAY_DAY)).toEqual(before)
    expect(statusIn((await getBank()).tasks, 'task-lift-bank')).toBe('inBank')
  })
})

describe('placing tasks on a given day', () => {
  it('pulls a bank task onto the given day, marked as placed by hand', async () => {
    const task = await pullFromBank('task-lift-bank', '2026-11-13')

    expect(task).toMatchObject({ status: 'planned', plannedDay: '2026-11-13', placedByHand: true })
    expect((await getDay('2026-11-13')).tasks.map((t) => t.id)).toContain('task-lift-bank')
  })

  it('pulls onto today when no day is given, still marked as placed by hand', async () => {
    const task = await pullFromBank('task-lift-bank')

    expect(task).toMatchObject({ plannedDay: '2026-11-11', placedByHand: true })
  })

  it('refuses a past day', async () => {
    await expect(pullFromBank('task-lift-bank', '2026-11-10')).rejects.toThrow("Can't place a task on a past day")
    expect(statusIn((await getBank()).tasks, 'task-lift-bank')).toBe('inBank')
  })

  it("puts a swapped-in task on the swapped task's day, not today", async () => {
    await pullFromBank('task-dentist', '2026-11-12')

    const { skipped, placed } = await swapTask('task-dentist', 'task-lift-bank')

    expect(placed).toMatchObject({ plannedDay: '2026-11-12', placedByHand: true })
    expect(skipped.placedByHand).toBeUndefined()
  })

  it('forgets placedByHand when a task goes back to the bank', async () => {
    await pullFromBank('task-lift-bank', '2026-11-12')

    const task = await skipTask('task-lift-bank')

    expect(task.placedByHand).toBeUndefined()
  })
})

describe('getWeek', () => {
  it("returns every task in this week, planned, done and in the bank", async () => {
    const week = await getWeek()

    expect(week.weekOf).toBe('2026-11-09')
    const statuses = new Map(week.tasks.map((task) => [task.id, task.status]))
    expect(statuses.get('task-lift-mon')).toBe('done')
    expect(statuses.get('task-lift-today')).toBe('planned')
    expect(statuses.get('task-lift-bank')).toBe('inBank')
    expect(statuses.get('task-groceries')).toBe('planned')
    expect(week.tasks.every((task) => task.weekOf === '2026-11-09')).toBe(true)
  })

  it('includes the goals, aspirations and recurring items the tasks reference', async () => {
    const week = await getWeek()

    expect(ids(week.goals)).toEqual(['goal-endurance', 'goal-garage', 'goal-strong'])
    expect(ids(week.aspirations)).toEqual(['asp-fit', 'asp-home'])
    expect(ids(week.recurringItems)).toEqual(['rec-laundry', 'rec-trash'])
  })

  it('includes a goal that has a target but no tasks this week, with its aspiration', async () => {
    const others = store.tasks.filter((task) => task.goalId !== 'goal-strong')
    store.tasks.splice(0, store.tasks.length, ...others)

    const week = await getWeek()

    expect(ids(week.weeklyTargets)).toEqual(['wt-endurance', 'wt-strong'])
    expect(ids(week.goals)).toContain('goal-strong')
    expect(ids(week.aspirations)).toContain('asp-fit')
  })

  it("includes each active goal's current weekly target", async () => {
    const { weeklyTargets } = await getWeek()

    expect(weeklyTargets).toEqual([
      { id: 'wt-strong', goalId: 'goal-strong', amount: 3, unit: 'lifting sessions', effectiveFrom: '2026-10-05' },
      { id: 'wt-endurance', goalId: 'goal-endurance', amount: 2, unit: 'runs', effectiveFrom: '2026-10-12' },
    ])
  })

  it('reflects changes made through the other functions', async () => {
    await pullFromBank('task-lift-bank', '2026-11-14')

    const lift = (await getWeek()).tasks.find((task) => task.id === 'task-lift-bank')
    expect(lift).toMatchObject({ status: 'planned', plannedDay: '2026-11-14', placedByHand: true })
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

  it("returns the goals' milestones in each goal's order", async () => {
    const { milestones } = await getAspirations()

    expect(milestones.filter((milestone) => milestone.goalId === 'goal-strong').map((milestone) => milestone.id)).toEqual([
      'ms-strong-1',
      'ms-strong-2',
      'ms-strong-3',
      'ms-strong-4',
      'ms-strong-5',
    ])
    expect(milestones).toHaveLength(store.milestones.length)
  })

  it('returns only active recurring items', async () => {
    store.recurringItems.find((item) => item.id === 'rec-hockey')!.active = false

    const { recurringItems } = await getAspirations()

    expect(ids(recurringItems)).toEqual(['rec-laundry', 'rec-rent', 'rec-stretch', 'rec-trash'])
  })

  it('returns the weekly target in force for each active goal that has one', async () => {
    store.weeklyTargets.push(
      { id: 'wt-strong-next', goalId: 'goal-strong', amount: 4, unit: 'lifting sessions', effectiveFrom: '2026-11-16' },
      { id: 'wt-cook', goalId: 'goal-cook', amount: 5, unit: 'dinners', effectiveFrom: '2026-10-05' },
    )

    const { weeklyTargets } = await getAspirations()

    expect(ids(weeklyTargets)).toEqual(['wt-endurance', 'wt-strong'])
  })

  it("returns this week's tasks that belong to a goal, and no others", async () => {
    store.tasks.push({
      id: 'task-lift-next-week',
      title: 'Lift: squat day',
      status: 'inBank',
      weekOf: '2026-11-16',
      goalId: 'goal-strong',
      rolloverCount: 0,
    })

    const { weekTasks } = await getAspirations()

    expect(weekTasks.every((task) => task.goalId !== undefined && task.weekOf === '2026-11-09')).toBe(true)
    expect(ids(weekTasks)).toContain('task-run-mon')
    expect(ids(weekTasks)).not.toContain('task-groceries')
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
  it('returns the aspiration with its goals of every status and their milestones in order', async () => {
    const detail = await getAspiration('asp-fit')

    expect(detail.aspiration).toMatchObject({ id: 'asp-fit', name: 'Be fit', priority: 1 })
    expect(ids(detail.goals)).toEqual(['goal-5k', 'goal-endurance', 'goal-look-good', 'goal-strong'])
    expect(detail.milestones.filter((milestone) => milestone.goalId === 'goal-strong').map((milestone) => milestone.id)).toEqual([
      'ms-strong-1',
      'ms-strong-2',
      'ms-strong-3',
      'ms-strong-4',
      'ms-strong-5',
    ])
    expect(detail.milestones.every((milestone) => ['goal-strong', 'goal-endurance', 'goal-look-good'].includes(milestone.goalId))).toBe(true)
  })

  it('returns its recurring items, active or not', async () => {
    store.recurringItems.find((item) => item.id === 'rec-hockey')!.active = false

    const { recurringItems } = await getAspiration('asp-fit')

    expect(ids(recurringItems)).toEqual(['rec-hockey', 'rec-stretch'])
  })

  it("returns this week's targets and goal tasks for its goals only", async () => {
    const { weeklyTargets, weekTasks } = await getAspiration('asp-fit')

    expect(ids(weeklyTargets)).toEqual(['wt-endurance', 'wt-strong'])
    expect(weekTasks.length).toBeGreaterThan(0)
    expect(
      weekTasks.every((task) => ['goal-strong', 'goal-endurance', 'goal-look-good', 'goal-5k'].includes(task.goalId!)),
    ).toBe(true)
    expect(weekTasks.every((task) => task.weekOf === '2026-11-09')).toBe(true)
  })

  it('counts the active aspirations', async () => {
    const { activeCount } = await getAspiration('asp-home')

    expect(activeCount).toBe(2)
  })

  it('returns a retired aspiration with its reached goal and no priority', async () => {
    const detail = await getAspiration('asp-spanish')

    expect(detail.aspiration.status).toBe('retired')
    expect(detail.aspiration.priority).toBeUndefined()
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
    expect(detail.weeklyTarget).toMatchObject({ id: 'wt-strong', amount: 3, unit: 'lifting sessions' })
  })

  it('returns the latest target that has started this week', async () => {
    store.weeklyTargets.push(
      { id: 'wt-strong-4', goalId: 'goal-strong', amount: 4, unit: 'lifting sessions', effectiveFrom: '2026-11-09' },
      { id: 'wt-strong-next', goalId: 'goal-strong', amount: 5, unit: 'lifting sessions', effectiveFrom: '2026-11-16' },
    )

    const { weeklyTarget } = await getGoal('goal-strong')

    expect(weeklyTarget?.id).toBe('wt-strong-4')
  })

  it('still returns the target of a paused goal', async () => {
    store.goals.find((goal) => goal.id === 'goal-strong')!.status = 'paused'

    const { weeklyTarget } = await getGoal('goal-strong')

    expect(weeklyTarget?.id).toBe('wt-strong')
  })

  it('returns a goal with no aspiration, milestones or target', async () => {
    const detail = await getGoal('goal-taxes')

    expect(detail.goal.status).toBe('reached')
    expect(detail.aspiration).toBeUndefined()
    expect(detail.milestones).toEqual([])
    expect(detail.weeklyTarget).toBeUndefined()
  })

  it('returns a paused goal with no target', async () => {
    const detail = await getGoal('goal-cook')

    expect(detail.goal.status).toBe('paused')
    expect(detail.aspiration?.id).toBe('asp-home')
    expect(detail.weeklyTarget).toBeUndefined()
  })

  it('rejects an unknown id as not found', async () => {
    await expect(getGoal('goal-nope')).rejects.toThrow(NotFoundError)
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getGoal('goal-strong')
    first.goal.label = 'changed'
    first.milestones[0].measurableLine = 'changed'
    first.weeklyTarget!.amount = 9

    const second = await getGoal('goal-strong')
    expect(second.goal.label).toBe('Be strong')
    expect(second.milestones[0].measurableLine).not.toBe('changed')
    expect(second.weeklyTarget?.amount).toBe(3)
  })
})

describe('setWeeklyTarget', () => {
  it('adds a target from this Monday and keeps the earlier one', async () => {
    const target = await setWeeklyTarget('goal-strong', 4, 'lifting sessions')

    expect(target).toMatchObject({ goalId: 'goal-strong', amount: 4, unit: 'lifting sessions', effectiveFrom: '2026-11-09' })
    expect(store.weeklyTargets.find((row) => row.id === 'wt-strong')?.amount).toBe(3)
    expect((await getGoal('goal-strong')).weeklyTarget?.amount).toBe(4)
  })

  it('updates this week’s row when changed again the same week', async () => {
    await setWeeklyTarget('goal-strong', 4, 'lifting sessions')
    await setWeeklyTarget('goal-strong', 2, ' gym visits ')

    const rows = store.weeklyTargets.filter((row) => row.goalId === 'goal-strong')
    expect(rows.map((row) => [row.effectiveFrom, row.amount, row.unit])).toEqual([
      ['2026-10-05', 3, 'lifting sessions'],
      ['2026-11-09', 2, 'gym visits'],
    ])
  })

  it('gives a goal its first target', async () => {
    await setWeeklyTarget('goal-look-good', 4, 'clean meals')

    expect((await getGoal('goal-look-good')).weeklyTarget).toMatchObject({ amount: 4, unit: 'clean meals' })
  })

  it('shows on Week at once', async () => {
    await setWeeklyTarget('goal-strong', 4, 'lifting sessions')

    const week = await getWeek()
    expect(week.weeklyTargets.find((row) => row.goalId === 'goal-strong')?.amount).toBe(4)
  })

  // Browsers only offer crypto.randomUUID on secure pages, and the dev server
  // reached from a phone is plain http.
  it('works where crypto.randomUUID is missing, and gives each new row its own id', async () => {
    vi.stubGlobal('crypto', {})
    try {
      const first = await setWeeklyTarget('goal-strong', 4, 'lifting sessions')
      const second = await setWeeklyTarget('goal-endurance', 3, 'runs')
      const milestone = await addMilestone('goal-strong', { measurableLine: 'Bench 172' })

      expect(new Set([first.id, second.id, milestone.id]).size).toBe(3)
      expect(first.id).toMatch(/^wt-/)
      expect(milestone.id).toMatch(/^ms-/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects an amount below 1 or not whole, and a blank unit', async () => {
    await expect(setWeeklyTarget('goal-strong', 0, 'lifting sessions')).rejects.toThrow()
    await expect(setWeeklyTarget('goal-strong', 2.5, 'lifting sessions')).rejects.toThrow()
    await expect(setWeeklyTarget('goal-strong', 3, '  ')).rejects.toThrow()
    expect(store.weeklyTargets.filter((row) => row.goalId === 'goal-strong')).toHaveLength(1)
  })

  it('rejects a goal that is not building, or is reached or ended, and an unknown one', async () => {
    await expect(setWeeklyTarget('goal-garage', 1, 'trips to the dump')).rejects.toThrow()
    await expect(setWeeklyTarget('goal-5k', 3, 'runs')).rejects.toThrow()
    await expect(setWeeklyTarget('goal-nope', 3, 'runs')).rejects.toThrow(NotFoundError)
  })
})

describe('addMilestone', () => {
  it('adds an upcoming milestone after the goal’s last one', async () => {
    const milestone = await addMilestone('goal-strong', { measurableLine: ' Bench 172 ', targetDate: '2027-02-01' })

    expect(milestone).toMatchObject({
      goalId: 'goal-strong',
      measurableLine: 'Bench 172',
      status: 'upcoming',
      targetDate: '2027-02-01',
    })
    const { milestones } = await getGoal('goal-strong')
    expect(milestones.map((row) => row.id).at(-1)).toBe(milestone.id)
    expect(milestones).toHaveLength(6)
  })

  it('adds one with no date, and a goal’s first', async () => {
    const milestone = await addMilestone('goal-cook', { measurableLine: 'Cook 3 nights a week' })

    expect(milestone.targetDate).toBeUndefined()
    expect((await getGoal('goal-cook')).milestones.map((row) => row.id)).toEqual([milestone.id])
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

describe('checkInMilestone', () => {
  function milestoneById(id: string) {
    return store.milestones.find((milestone) => milestone.id === id)!
  }

  it('marks Next hit with today and the result, so the following one is Next', async () => {
    const checked = await checkInMilestone('ms-strong-2', 'hit', ' Bench 155, squat 305, deadlift 350 ')

    expect(checked).toMatchObject({
      status: 'hit',
      result: 'Bench 155, squat 305, deadlift 350',
      checkedInOn: WEDNESDAY_DAY,
    })
    await expect(checkInMilestone('ms-strong-3', 'notYet')).resolves.toMatchObject({ status: 'notYet' })
  })

  it('marks not yet with the result, and keeps no blank result', async () => {
    const checked = await checkInMilestone('ms-strong-2', 'notYet', '   ')

    expect(checked.status).toBe('notYet')
    expect(checked.checkedInOn).toBe(WEDNESDAY_DAY)
    expect(checked).not.toHaveProperty('result')
  })

  it('takes only Next on a building goal, but any step not done on a one-off goal', async () => {
    await expect(checkInMilestone('ms-strong-4', 'hit')).rejects.toThrow()
    expect(milestoneById('ms-strong-4').status).toBe('upcoming')

    await expect(checkInMilestone('ms-garage-5', 'hit')).resolves.toMatchObject({ status: 'hit' })
  })

  it('rejects a hit milestone, an unknown one, and any on a reached goal', async () => {
    await expect(checkInMilestone('ms-strong-1', 'hit')).rejects.toThrow()
    await expect(checkInMilestone('ms-nope', 'hit')).rejects.toThrow(NotFoundError)
    store.goals.find((goal) => goal.id === 'goal-strong')!.status = 'reached'
    await expect(checkInMilestone('ms-strong-2', 'hit')).rejects.toThrow()
  })
})

describe('reopenMilestone', () => {
  function datesOf(milestones: { targetDate?: string }[]) {
    return milestones.map((milestone) => milestone.targetDate)
  }

  it('keeps the date: back to upcoming, still Next, nothing else moves', async () => {
    const milestones = await reopenMilestone('ms-strong-2')

    expect(milestones.map((milestone) => milestone.status)).toEqual(['hit', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-06', '2026-11-30', undefined, undefined])
    expect(milestones[1].result).toBe('Bench 152, squat 300, deadlift 340')
  })

  it('moves the date three weeks later and pushes the next one by three weeks', async () => {
    const milestones = await reopenMilestone('ms-strong-2', { targetDate: '2026-11-27' })

    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-27', '2026-12-21', undefined, undefined])
    expect(datesOf((await getGoal('goal-strong')).milestones)).toEqual(datesOf(milestones))
  })

  it('pushes nothing past the deadline', async () => {
    store.goals.find((goal) => goal.id === 'goal-strong')!.deadline = '2026-12-10'

    const milestones = await reopenMilestone('ms-strong-2', { targetDate: '2026-11-27' })

    expect(datesOf(milestones)).toEqual(['2026-11-02', '2026-11-27', '2026-12-10', undefined, undefined])
  })

  it('adjusts the line, trimmed', async () => {
    const milestones = await reopenMilestone('ms-strong-2', { measurableLine: ' Bench 153, squat 300, deadlift 340 ' })

    expect(milestones[1]).toMatchObject({ measurableLine: 'Bench 153, squat 300, deadlift 340', status: 'upcoming' })
  })

  it('rejects a blank line, a date outside the goal, one not marked not yet, an unknown one and a reached goal', async () => {
    await expect(reopenMilestone('ms-strong-2', { measurableLine: '  ' })).rejects.toThrow()
    await expect(reopenMilestone('ms-strong-2', { targetDate: '2026-10-01' })).rejects.toThrow()
    await expect(reopenMilestone('ms-strong-3')).rejects.toThrow()
    await expect(reopenMilestone('ms-nope')).rejects.toThrow(NotFoundError)
    expect(store.milestones.find((milestone) => milestone.id === 'ms-strong-2')!.status).toBe('notYet')

    store.goals.find((goal) => goal.id === 'goal-strong')!.status = 'ended'
    await expect(reopenMilestone('ms-strong-2')).rejects.toThrow()
  })
})

describe('pauseGoal and resumeGoal', () => {
  const task = (id: string) => store.tasks.find((candidate) => candidate.id === id)!
  const goalById = (id: string) => store.goals.find((goal) => goal.id === id)!

  it('pausing sets this week’s waiting tasks aside, keeping their day, and leaves done ones', async () => {
    const paused = await pauseGoal('goal-strong')

    expect(paused.status).toBe('paused')
    expect(task('task-lift-today')).toMatchObject({ status: 'skipped', plannedDay: WEDNESDAY_DAY })
    expect(task('task-lift-bank').status).toBe('skipped')
    expect(task('task-lift-mon').status).toBe('done')
    expect(ids((await getDay(WEDNESDAY_DAY)).tasks)).not.toContain('task-lift-today')
    expect(ids((await getBank()).tasks)).not.toContain('task-lift-bank')
    expect((await getWeek()).weeklyTargets.map((target) => target.goalId)).not.toContain('goal-strong')
  })

  it('resuming puts those tasks back in this week’s bank, with no day', async () => {
    await pauseGoal('goal-strong')
    await pauseGoal('goal-endurance')

    const resumed = await resumeGoal('goal-strong')

    expect(resumed.status).toBe('active')
    for (const id of ['task-lift-today', 'task-lift-bank']) {
      expect(task(id).status).toBe('inBank')
      expect(task(id)).not.toHaveProperty('plannedDay')
      expect(task(id)).not.toHaveProperty('placedByHand')
    }
    expect(ids((await getBank()).tasks)).toEqual(expect.arrayContaining(['task-lift-bank', 'task-lift-today']))
    expect(task('task-run-bank').status).toBe('skipped')
    expect(task('task-lift-mon').status).toBe('done')
  })

  it('resumes a goal whose aspiration is retired, keeping the aspiration', async () => {
    await retireAspiration('asp-fit', 'pause')

    const resumed = await resumeGoal('goal-strong')

    expect(resumed).toMatchObject({ status: 'active', aspirationId: 'asp-fit' })
    expect(ids((await getBank()).tasks)).toContain('task-lift-bank')
  })

  it('rejects pausing a goal that isn’t active, resuming an active or reached one, and unknown ids', async () => {
    await expect(pauseGoal('goal-cook')).rejects.toThrow()
    await expect(pauseGoal('goal-5k')).rejects.toThrow()
    await expect(resumeGoal('goal-strong')).rejects.toThrow()
    await expect(resumeGoal('goal-5k')).rejects.toThrow()
    await expect(pauseGoal('goal-nope')).rejects.toThrow(NotFoundError)
    await expect(resumeGoal('goal-nope')).rejects.toThrow(NotFoundError)
    expect(goalById('goal-5k').status).toBe('reached')
  })
})

describe('endGoal', () => {
  const task = (id: string) => store.tasks.find((candidate) => candidate.id === id)!

  it('marks it reached today, and moves no tasks', async () => {
    const ended = await endGoal('goal-strong', 'reached')

    expect(ended).toMatchObject({ status: 'reached', endedAt: WEDNESDAY_DAY })
    expect(task('task-lift-today').status).toBe('planned')
    expect(task('task-lift-bank').status).toBe('inBank')
  })

  it('ends it for now, from active or paused', async () => {
    await expect(endGoal('goal-strong', 'ended')).resolves.toMatchObject({ status: 'ended', endedAt: WEDNESDAY_DAY })
    await expect(endGoal('goal-cook', 'ended')).resolves.toMatchObject({ status: 'ended' })
  })

  it('goes again: resuming an ended goal makes it active and clears the end date', async () => {
    await endGoal('goal-strong', 'ended')

    const again = await resumeGoal('goal-strong')

    expect(again.status).toBe('active')
    expect(again).not.toHaveProperty('endedAt')
    expect(task('task-lift-today').status).toBe('planned')
  })

  it('rejects ending a reached or ended goal, and an unknown one', async () => {
    await expect(endGoal('goal-5k', 'ended')).rejects.toThrow()
    await endGoal('goal-strong', 'ended')
    await expect(endGoal('goal-strong', 'reached')).rejects.toThrow()
    await expect(endGoal('goal-nope', 'reached')).rejects.toThrow(NotFoundError)
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

    expect(saved.why).toBeUndefined()
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
  function addActive(id: string, priority: number) {
    store.aspirations.push({ id, name: id, priority, status: 'active', createdAt: '2026-11-01T09:00:00Z' })
  }

  it('moves the first one down, and returns the active ones in order', async () => {
    const order = await moveAspiration('asp-fit', 'down')

    expect(order.map((aspiration) => [aspiration.id, aspiration.priority])).toEqual([
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
    expect(down.map((aspiration) => [aspiration.id, aspiration.priority])).toEqual([
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
  const taskStatus = (id: string) => store.tasks.find((task) => task.id === id)?.status

  function addStretchOnThursday() {
    store.tasks.push({
      id: 'task-stretch-thu',
      title: 'Stretch',
      status: 'planned',
      weekOf: '2026-11-09',
      plannedDay: '2026-11-12',
      recurringItemId: 'rec-stretch',
      rolloverCount: 0,
      placedByHand: true,
    })
  }

  it('retires it with the time, takes away its priority and moves the ones below up', async () => {
    const saved = await retireAspiration('asp-fit', 'pause')

    expect(saved).toMatchObject({ status: 'retired', retiredAt: WEDNESDAY.toISOString() })
    expect(saved.priority).toBeUndefined()
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-home')?.priority).toBe(1)
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
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ])
    expect(store.tasks.find((task) => task.id === 'task-stretch-thu')?.plannedDay).toBe('2026-11-12')
    expect(['task-lift-mon', 'task-run-mon'].map(taskStatus)).toEqual(['done', 'done'])
    expect(['task-laundry', 'task-donate-bikes'].map(taskStatus)).toEqual(['planned', 'planned'])
  })

  it("with pause, leaves its goals' tasks in other weeks alone", async () => {
    store.tasks.push({
      id: 'task-lift-next-week',
      title: 'Lift: squat day',
      status: 'inBank',
      weekOf: '2026-11-16',
      goalId: 'goal-strong',
      rolloverCount: 0,
    })

    await retireAspiration('asp-fit', 'pause')

    expect(taskStatus('task-lift-next-week')).toBe('inBank')
  })

  it('with pause, leaves its tasks off every day, the bank, Week and Keep life running', async () => {
    addStretchOnThursday()

    await retireAspiration('asp-fit', 'pause')

    expect(ids((await getDay(WEDNESDAY_DAY)).tasks)).not.toContain('task-lift-today')
    expect(ids((await getDay('2026-11-12')).tasks)).not.toContain('task-stretch-thu')
    expect(ids((await getBank()).tasks)).toEqual(['task-dentist', 'task-garage-shelves'])
    const week = await getWeek()
    expect(week.weeklyTargets).toEqual([])
    expect(week.tasks.filter((task) => task.status === 'planned' || task.status === 'inBank').map((task) => task.goalId)).not.toContain(
      'goal-strong',
    )
    expect(ids((await getUpkeep()).tasks)).not.toContain('task-stretch-thu')
  })

  it('with keep, its goals and recurring items carry on with no aspiration', async () => {
    store.goals.find((goal) => goal.id === 'goal-look-good')!.status = 'paused'

    await retireAspiration('asp-fit', 'keep')

    const kept = store.goals.filter((goal) => ['goal-strong', 'goal-endurance', 'goal-look-good'].includes(goal.id))
    expect(kept.map((goal) => [goal.status, goal.aspirationId])).toEqual([
      ['active', undefined],
      ['active', undefined],
      ['paused', undefined],
    ])
    expect(store.goals.find((goal) => goal.id === 'goal-5k')?.aspirationId).toBe('asp-fit')
    const items = store.recurringItems.filter((item) => ['rec-stretch', 'rec-hockey'].includes(item.id))
    expect(items.map((item) => [item.active, item.aspirationId])).toEqual([
      [true, undefined],
      [true, undefined],
    ])
    expect(taskStatus('task-lift-today')).toBe('planned')
  })

  it('rejects retiring a retired aspiration or an unknown id, changing nothing', async () => {
    await expect(retireAspiration('asp-spanish', 'pause')).rejects.toThrow('asp-spanish is retired')
    await expect(retireAspiration('asp-nope', 'pause')).rejects.toThrow('No aspiration with id asp-nope')
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-spanish')?.retiredAt).toBe('2026-09-15T09:00:00Z')
  })
})

describe('bringBackAspiration', () => {
  it('makes a retired aspiration active again, last in priority', async () => {
    const saved = await bringBackAspiration('asp-spanish')

    expect(saved).toMatchObject({ status: 'active', priority: 3 })
    expect(saved.retiredAt).toBeUndefined()
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

    await checkOffTask('task-ballot')

    expect(ids((await getUpkeep()).tasks)).not.toContain('task-ballot')
  })

  it('includes later weeks and leaves out earlier ones', async () => {
    const loose = { title: 'Renew the insurance', status: 'inBank' as const, rolloverCount: 0 }
    store.tasks.push({ ...loose, id: 'task-next-week', weekOf: '2026-11-16' }, { ...loose, id: 'task-last-week', weekOf: '2026-11-02' })

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
