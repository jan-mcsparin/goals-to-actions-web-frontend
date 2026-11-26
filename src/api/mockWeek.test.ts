import { describe, expect, it } from 'vitest'
import { aTask } from '../test/tasks.ts'
import { countsOf, dayCountsOf, fixedDayIn } from './mockWeek.ts'

const MONDAY = '2026-11-23'

describe('countsOf', () => {
  it('counts tasks by origin, and the goals the sessions are for', () => {
    const tasks = [
      aTask('lift-1', { goalId: 'lift' }),
      aTask('lift-2', { goalId: 'lift', state: 'done' }),
      aTask('run-1', { goalId: 'run' }),
      aTask('trash', { recurringItemId: 'trash' }),
      aTask('dentist'),
    ]
    expect(countsOf(tasks)).toEqual({ goalSessions: 3, goals: 2, upkeep: 1, added: 1 })
  })
})

describe('dayCountsOf', () => {
  it('counts only the tasks on that day', () => {
    const tasks = [
      aTask('lift-1', { goalId: 'lift', plannedDay: '2026-11-24' }),
      aTask('trash', { recurringItemId: 'trash', plannedDay: '2026-11-24' }),
      aTask('dentist', { plannedDay: '2026-11-25' }),
      aTask('bank'),
    ]
    expect(dayCountsOf(tasks, '2026-11-24')).toEqual({ goalSessions: 1, upkeep: 1, added: 0 })
  })
})

describe('fixedDayIn', () => {
  it('finds a weekly item on its weekday', () => {
    expect(fixedDayIn({ kind: 'weekly', weekday: 'tuesday' }, MONDAY)).toBe('2026-11-24')
  })

  it('finds a monthly item in the week that holds its day, and in no other', () => {
    expect(fixedDayIn({ kind: 'monthly', dayOfMonth: 1 }, '2026-11-30')).toBe('2026-12-01')
    expect(fixedDayIn({ kind: 'monthly', dayOfMonth: 1 }, MONDAY)).toBeNull()
  })

  it('has none for a flexible item', () => {
    expect(fixedDayIn({ kind: 'flexible', times: 2, period: 'week' }, MONDAY)).toBeNull()
  })
})
