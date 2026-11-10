import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkOffTask,
  getBank,
  getDay,
  getWeek,
  pullFromBank,
  skipTask,
  swapTask,
  uncheckTask,
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
    expect(ids(bank.tasks)).toEqual(['task-dentist', 'task-garage-shelves', 'task-lift-bank'])
    expect(ids(bank.goals)).toEqual(['goal-garage', 'goal-strong'])
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

    expect(ids(week.goals)).toEqual(['goal-garage', 'goal-strong'])
    expect(ids(week.aspirations)).toEqual(['asp-fit', 'asp-home'])
    expect(ids(week.recurringItems)).toEqual(['rec-laundry', 'rec-trash'])
  })

  it('includes a goal that has a target but no tasks this week, with its aspiration', async () => {
    const others = store.tasks.filter((task) => task.goalId !== 'goal-strong')
    store.tasks.splice(0, store.tasks.length, ...others)

    const week = await getWeek()

    expect(ids(week.weeklyTargets)).toEqual(['wt-strong'])
    expect(ids(week.goals)).toContain('goal-strong')
    expect(ids(week.aspirations)).toContain('asp-fit')
  })

  it("includes each active goal's current weekly target", async () => {
    const { weeklyTargets } = await getWeek()

    expect(weeklyTargets).toEqual([
      { id: 'wt-strong', goalId: 'goal-strong', amount: 3, unit: 'lifting sessions', effectiveFrom: '2026-10-05' },
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
