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

  it('has two aspirations, each with a goal', () => {
    expect(data.aspirations).toHaveLength(2)
    for (const aspiration of data.aspirations) {
      expect(data.goals.some((goal) => goal.aspirationId === aspiration.id)).toBe(true)
    }
  })

  it('gives Be strong a baseline, a weekly target and three milestones', () => {
    const strong = data.goals.find((goal) => goal.label === 'Be strong')
    expect(strong?.baseline).toBeDefined()
    expect(data.weeklyTargets.filter((target) => target.goalId === strong?.id)).toHaveLength(1)

    const milestones = data.milestones.filter((milestone) => milestone.goalId === strong?.id)
    expect(milestones.some((milestone) => milestone.status === 'hit')).toBe(true)
    expect(milestones.some((m) => m.status === 'upcoming' && m.targetDate)).toBe(true)
    expect(milestones.some((m) => m.status === 'upcoming' && !m.targetDate)).toBe(true)
  })

  it('has fixed-day and flexible recurring items', () => {
    expect(data.recurringItems).toHaveLength(3)
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
