import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask, getToday, uncheckTask } from './client.ts'
import { resetStore } from './mockStore.ts'

// Wednesday 11 Nov 2026, 9 a.m. local time.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)

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

describe('getToday', () => {
  it("returns only tasks planned for today's date", async () => {
    const plan = await getToday()

    expect(plan.date).toBe('2026-11-11')
    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.tasks.every((task) => task.plannedDay === '2026-11-11')).toBe(true)
  })

  it('includes a mix of timed, untimed, goal, maintenance and unlinked tasks', async () => {
    const { tasks } = await getToday()

    expect(tasks.some((task) => task.timeOfDay?.kind === 'by')).toBe(true)
    expect(tasks.some((task) => task.timeOfDay?.kind === 'at')).toBe(true)
    expect(tasks.some((task) => !task.timeOfDay)).toBe(true)
    expect(tasks.some((task) => task.goalId)).toBe(true)
    expect(tasks.some((task) => task.recurringItemId)).toBe(true)
    expect(tasks.some((task) => !task.goalId && !task.recurringItemId)).toBe(true)
  })

  it('returns exactly the goals, recurring items and aspirations the tasks reference', async () => {
    const plan = await getToday()

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

  it('uses the local date late in the evening', async () => {
    vi.setSystemTime(new Date(2026, 10, 11, 23, 30))

    expect((await getToday()).date).toBe('2026-11-11')
  })

  it('returns copies, so changing them does not change the store', async () => {
    const first = await getToday()
    first.tasks[0].title = 'changed'
    first.goals[0].label = 'changed'

    const second = await getToday()
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

  it('is reflected in the next getToday', async () => {
    await checkOffTask('task-laundry')

    const { tasks } = await getToday()
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('done')
  })

  it('is undone by resetStore', async () => {
    await checkOffTask('task-laundry')
    resetStore()

    const { tasks } = await getToday()
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(checkOffTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('returns a copy, so changing it does not change the store', async () => {
    const task = await checkOffTask('task-laundry')
    task.status = 'skipped'

    const { tasks } = await getToday()
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

  it('is reflected in the next getToday', async () => {
    await checkOffTask('task-laundry')
    await uncheckTask('task-laundry')

    const { tasks } = await getToday()
    expect(tasks.find((task) => task.id === 'task-laundry')?.status).toBe('planned')
  })

  it('rejects an unknown task id', async () => {
    await expect(uncheckTask('no-such-task')).rejects.toThrow('no-such-task')
  })

  it('rejects a task that is not done', async () => {
    await expect(uncheckTask('task-laundry')).rejects.toThrow('not done')
  })
})
