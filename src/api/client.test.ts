import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToday } from './client.ts'
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
