import { describe, expect, it } from 'vitest'
import { buildMockData } from './mockData.ts'

const MONDAY = new Date(2026, 10, 9, 9)
const WEDNESDAY = new Date(2026, 10, 11, 9)
const SUNDAY_LATE = new Date(2026, 10, 15, 23, 30)

describe.each([
  ['Monday', MONDAY],
  ['Wednesday', WEDNESDAY],
  ['late Sunday', SUNDAY_LATE],
])('mock data built on %s', (_name, today) => {
  const data = buildMockData(today)
  const goalIds = new Set(data.goals.map((goal) => goal.id))
  const aspirationIds = new Set(data.aspirations.map((aspiration) => aspiration.id))
  const recurringIds = new Set(data.recurringItems.map((item) => item.id))

  it('has unique ids across all records', () => {
    const all = [
      ...data.aspirations,
      ...data.goals,
      ...data.milestones,
      ...data.weeklyTargets,
      ...data.recurringItems,
      ...data.tasks,
    ].map((record) => record.id)
    expect(new Set(all).size).toBe(all.length)
  })

  it('only references records that exist', () => {
    for (const goal of data.goals) {
      if (goal.aspirationId) expect(aspirationIds).toContain(goal.aspirationId)
    }
    for (const item of data.recurringItems) {
      if (item.aspirationId) expect(aspirationIds).toContain(item.aspirationId)
    }
    for (const record of [...data.milestones, ...data.weeklyTargets]) {
      expect(goalIds).toContain(record.goalId)
    }
    for (const task of data.tasks) {
      if (task.goalId) expect(goalIds).toContain(task.goalId)
      if (task.recurringItemId) expect(recurringIds).toContain(task.recurringItemId)
    }
  })

  it("puts every task in the current week, which starts on a Monday", () => {
    for (const task of data.tasks) {
      expect(task.weekOf).toBe('2026-11-09')
      if (task.plannedDay) {
        expect(task.plannedDay >= '2026-11-09' && task.plannedDay <= '2026-11-15').toBe(true)
      }
    }
  })

  it('leaves bank tasks without a day and gives planned and done tasks one', () => {
    for (const task of data.tasks) {
      if (task.status === 'inBank') expect(task.plannedDay).toBeUndefined()
      if (task.status === 'planned' || task.status === 'done') expect(task.plannedDay).toBeDefined()
    }
  })
})

describe('mock data contents', () => {
  const data = buildMockData(WEDNESDAY)

  function hitCount(goalId: string): [number, number] {
    const milestones = data.milestones.filter((milestone) => milestone.goalId === goalId)
    return [milestones.filter((milestone) => milestone.status === 'hit').length, milestones.length]
  }

  it('has two active aspirations and a retired one, each with a goal', () => {
    expect(data.aspirations.map((aspiration) => aspiration.status)).toEqual(['active', 'active', 'retired'])
    expect(data.aspirations.find((aspiration) => aspiration.status === 'retired')?.retiredAt).toBeDefined()
    expect(data.aspirations.find((aspiration) => aspiration.name === 'Keep a calm home')?.why).toBeUndefined()
    for (const aspiration of data.aspirations) {
      expect(data.goals.some((goal) => goal.aspirationId === aspiration.id)).toBe(true)
    }
  })

  it('numbers active aspirations 1, 2, … in priority order and gives retired ones no priority', () => {
    const active = data.aspirations.filter((aspiration) => aspiration.status === 'active')
    const retired = data.aspirations.filter((aspiration) => aspiration.status === 'retired')
    expect(active.map((aspiration) => aspiration.priority).sort()).toEqual([1, 2])
    expect(retired.every((aspiration) => aspiration.priority === undefined)).toBe(true)
  })

  it('gives Be strong a baseline, a weekly target and five milestones', () => {
    const strong = data.goals.find((goal) => goal.label === 'Be strong')
    expect(strong?.baseline).toBeDefined()
    expect(data.weeklyTargets.filter((target) => target.goalId === strong?.id)).toHaveLength(1)

    const milestones = data.milestones.filter((milestone) => milestone.goalId === strong?.id)
    expect(milestones.map((milestone) => milestone.status)).toEqual([
      'hit',
      'notYet',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
    expect(milestones.some((m) => m.status === 'upcoming' && m.targetDate)).toBe(true)
    expect(milestones.some((m) => m.status === 'upcoming' && !m.targetDate)).toBe(true)
  })

  it('gives Have endurance two runs a week, one done on Monday and one in the bank', () => {
    const runs = data.tasks.filter((task) => task.goalId === 'goal-endurance')
    expect(data.weeklyTargets.find((target) => target.goalId === 'goal-endurance')?.amount).toBe(2)
    expect(runs.map((task) => [task.status, task.plannedDay])).toEqual([
      ['done', '2026-11-09'],
      ['inBank', undefined],
    ])
    expect(hitCount('goal-endurance')).toEqual([2, 3])
  })

  it('gives Look good two milestones and no weekly target, and the garage five steps', () => {
    expect(hitCount('goal-look-good')).toEqual([0, 2])
    expect(data.weeklyTargets.some((target) => target.goalId === 'goal-look-good')).toBe(false)
    expect(hitCount('goal-garage')).toEqual([3, 5])
  })

  it('has paused and reached goals, and goals with no aspiration', () => {
    const under = (status: string) => data.goals.filter((goal) => goal.status === status && goal.aspirationId)
    expect(under('paused')).toHaveLength(1)
    expect(under('reached').length).toBeGreaterThanOrEqual(2)

    const loose = data.goals.filter((goal) => !goal.aspirationId)
    expect(loose.find((goal) => goal.status === 'active')?.deadline).toBeDefined()
    expect(loose.some((goal) => goal.status === 'reached')).toBe(true)
  })

  it('has fixed-day and flexible recurring items, two of them under Be fit', () => {
    expect(data.recurringItems).toHaveLength(5)
    expect(
      data.recurringItems.filter((item) => item.aspirationId === 'asp-fit').map((item) => item.name),
    ).toEqual(['Stretch', 'Hockey'])
    expect(data.recurringItems.some((item) => item.fixedDay)).toBe(true)
    expect(data.recurringItems.some((item) => !item.fixedDay)).toBe(true)
  })

  it('has done, bank and rolled-over tasks', () => {
    expect(data.tasks.some((task) => task.status === 'done')).toBe(true)
    expect(data.tasks.filter((task) => task.status === 'inBank').length).toBeGreaterThanOrEqual(2)
    expect(data.tasks.some((task) => task.rolloverCount >= 2)).toBe(true)
  })

  it('starts at normal intensity with weeks starting Monday', () => {
    expect(data.settings).toMatchObject({ intensity: 'normal', weekStartsOn: 'monday' })
  })
})
