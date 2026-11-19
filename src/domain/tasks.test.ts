import { describe, expect, it } from 'vitest'
import type { Task } from '../api/types'
import { checkedOff, isDone, isInBank, isOnDay, isPlanned, placedOnDay, uncheckedOff, weekOf } from './tasks'

const base: Task = { id: 't1', title: 'Run', status: 'inBank', weekOf: '2026-11-09', rolloverCount: 0 }
const planned: Task = { ...base, status: 'planned', plannedDay: '2026-11-11' }
const done: Task = { ...planned, status: 'done', completedAt: '2026-11-11T09:00:00Z', valueLogged: 3 }
const setAside: Task = { ...planned, status: 'skipped' }

describe('isInBank', () => {
  it('is true only for a task with no day', () => {
    expect(isInBank(base)).toBe(true)
    expect([planned, done, setAside].some(isInBank)).toBe(false)
  })
})

describe('isDone', () => {
  it('is true only for a done task', () => {
    expect(isDone(done)).toBe(true)
    expect([base, planned, setAside].some(isDone)).toBe(false)
  })
})

describe('isPlanned', () => {
  it('is true for an open task on a day, not a done, banked or set-aside one', () => {
    expect(isPlanned(planned)).toBe(true)
    expect([base, done, setAside].some(isPlanned)).toBe(false)
  })
})

describe('isOnDay', () => {
  it('counts open and done tasks on a day, and never a set-aside or banked one', () => {
    expect(isOnDay(planned)).toBe(true)
    expect(isOnDay(done)).toBe(true)
    expect(isOnDay(base)).toBe(false)
    expect(isOnDay(setAside)).toBe(false)
  })

  it('matches one day when given', () => {
    expect(isOnDay(planned, '2026-11-11')).toBe(true)
    expect(isOnDay(planned, '2026-11-12')).toBe(false)
    expect(isOnDay(setAside, '2026-11-11')).toBe(false)
  })
})

describe('weekOf', () => {
  it('is the week the task is in', () => {
    expect(weekOf(base)).toBe('2026-11-09')
  })
})

describe('placedOnDay', () => {
  it('puts the task on the day, by hand', () => {
    expect(placedOnDay(base, '2026-11-12')).toEqual({
      ...base,
      status: 'planned',
      plannedDay: '2026-11-12',
      placedByHand: true,
    })
  })
})

describe('checkedOff and uncheckedOff', () => {
  it('checks a task off at a moment', () => {
    expect(checkedOff(planned, '2026-11-11T10:00:00Z')).toEqual({
      ...planned,
      status: 'done',
      completedAt: '2026-11-11T10:00:00Z',
    })
  })

  it('unchecks a done task, clearing what the check-off recorded', () => {
    expect(uncheckedOff(done)).toEqual({ ...planned })
  })
})
