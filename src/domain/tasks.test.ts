import { describe, expect, it } from 'vitest'
import { aTask } from '../test/tasks'
import {
  canMoveInWeek,
  checkedOff,
  checkOffAt,
  inTheBank,
  isDone,
  isInBank,
  isOnDay,
  isPlanned,
  isSetItem,
  placedOnDay,
  uncheckedOff,
  weekOf,
} from './tasks'

const planned = aTask('t1', { plannedDay: '2026-11-11' })
const banked = aTask('t1')
const done = aTask('t1', {
  state: 'done',
  plannedDay: '2026-11-11',
  completedAt: '2026-11-11T09:00:00Z',
  completedOn: '2026-11-11',
  valueLogged: 3,
})
const dropped = aTask('t1', { state: 'dropped', plannedDay: '2026-11-11' })

describe('isInBank', () => {
  it('is true only for an open task with no day', () => {
    expect(isInBank(banked)).toBe(true)
    expect([planned, done, dropped].some(isInBank)).toBe(false)
  })
})

describe('isDone', () => {
  it('is true only for a done task', () => {
    expect(isDone(done)).toBe(true)
    expect([banked, planned, dropped].some(isDone)).toBe(false)
  })
})

describe('isPlanned', () => {
  it('is true for an open task on a day, not a done, banked or closed one', () => {
    expect(isPlanned(planned)).toBe(true)
    expect([banked, done, dropped].some(isPlanned)).toBe(false)
  })
})

describe('isOnDay', () => {
  it('counts open and done tasks on a day, and never a banked or closed one', () => {
    expect(isOnDay(planned)).toBe(true)
    expect(isOnDay(done)).toBe(true)
    expect(isOnDay(banked)).toBe(false)
    expect(isOnDay(dropped)).toBe(false)
  })

  it('matches one day when given', () => {
    expect(isOnDay(planned, '2026-11-11')).toBe(true)
    expect(isOnDay(planned, '2026-11-12')).toBe(false)
    expect(isOnDay(banked, '2026-11-11')).toBe(false)
  })
})

describe('weekOf', () => {
  it('is the week the task is in, or none while it waits', () => {
    expect(weekOf(banked)).toBe('2026-11-09')
    expect(weekOf(aTask('t2', { week: null }))).toBeNull()
  })
})

describe('placedOnDay and inTheBank', () => {
  it('puts the task on the day, by hand, and takes it off again', () => {
    const placed = placedOnDay(banked, '2026-11-12')
    expect(placed).toEqual({ ...banked, plannedDay: '2026-11-12', placedByHand: true })
    expect(inTheBank(placed)).toEqual(banked)
  })
})

describe('checkOffAt', () => {
  it('is the moment and the local day of the same tap', () => {
    const tap = new Date(2026, 10, 11, 21, 15)

    expect(checkOffAt(tap)).toEqual({ completedAt: tap.toISOString(), completedOn: '2026-11-11' })
  })

  it('counts just after midnight as the new day', () => {
    expect(checkOffAt(new Date(2026, 10, 12, 0, 30)).completedOn).toBe('2026-11-12')
  })
})

describe('checkedOff and uncheckedOff', () => {
  it('checks a task off at a moment, for a day', () => {
    expect(checkedOff(planned, { completedAt: '2026-11-11T10:00:00Z', completedOn: '2026-11-11' })).toEqual({
      ...planned,
      state: 'done',
      completedAt: '2026-11-11T10:00:00Z',
      completedOn: '2026-11-11',
    })
  })

  it('clears a value logged before when the check-off has none, as the API does', () => {
    expect(checkedOff(done, { completedAt: '2026-11-11T10:00:00Z', completedOn: '2026-11-11' }).valueLogged).toBeNull()
  })

  it('keeps a logged value', () => {
    const checkOff = { completedAt: '2026-11-11T10:00:00Z', completedOn: '2026-11-11', valueLogged: 3 }

    expect(checkedOff(planned, checkOff).valueLogged).toBe(3)
  })

  it('unchecks a done task, clearing what the check-off recorded', () => {
    expect(uncheckedOff(done)).toEqual(planned)
  })
})

describe('isSetItem', () => {
  const TODAY = '2026-11-11'

  it('is a task added by hand, open, on a day from today on', () => {
    expect(isSetItem(aTask('t1', { plannedDay: TODAY }), TODAY)).toBe(true)
    expect(isSetItem(aTask('t1', { plannedDay: '2026-12-02', week: '2026-11-30' }), TODAY)).toBe(true)
  })

  it("isn't a goal session, a recurring task, a done task, a bank task or yesterday's", () => {
    const notSet = [
      aTask('t1', { plannedDay: TODAY, goalId: 'goal-strong' }),
      aTask('t1', { plannedDay: TODAY, recurringItemId: 'rec-trash', fixedDay: true }),
      { ...done, plannedDay: TODAY },
      banked,
      aTask('t1', { plannedDay: '2026-11-10' }),
    ]

    expect(notSet.map((task) => isSetItem(task, TODAY))).toEqual([false, false, false, false, false])
  })

  it("counts a one-off goal's step added by hand", () => {
    expect(isSetItem(aTask('t1', { plannedDay: TODAY, goalId: 'goal-trip', origin: 'byHand' }), TODAY)).toBe(true)
  })
})

describe('canMoveInWeek', () => {
  const trash = aTask('trash', { recurringItemId: 'rec-trash', fixedDay: true, plannedDay: '2026-11-10' })

  it('is a fixed-day task on a day, with another day of its week from today on', () => {
    expect(canMoveInWeek(trash, '2026-11-11')).toBe(true)
    expect(canMoveInWeek({ ...trash, plannedDay: '2026-11-15' }, '2026-11-15')).toBe(false)
  })

  it("isn't a task that isn't fixed-day, nor a done one", () => {
    expect(canMoveInWeek({ ...trash, fixedDay: false }, '2026-11-11')).toBe(false)
    expect(canMoveInWeek({ ...trash, state: 'done' }, '2026-11-11')).toBe(false)
  })
})
