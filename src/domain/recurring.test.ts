import { describe, expect, it } from 'vitest'
import type { Schedule } from '../api/types.ts'
import { isFixedDay, ordinal, repeatText } from './recurring.ts'

describe('repeatText', () => {
  it.each<[Schedule, string]>([
    [{ kind: 'weekly', weekday: 'tuesday' }, 'Every Tuesday'],
    [{ kind: 'weekly', weekday: 'sunday' }, 'Every Sunday'],
    [{ kind: 'monthly', dayOfMonth: 1 }, 'Monthly on the 1st'],
    [{ kind: 'monthly', dayOfMonth: 22 }, 'Monthly on the 22nd'],
    [{ kind: 'monthly', dayOfMonth: 28 }, 'Monthly on the 28th'],
    [{ kind: 'flexible', times: 1, period: 'week' }, 'Once a week'],
    [{ kind: 'flexible', times: 3, period: 'week' }, '3 times a week'],
    [{ kind: 'flexible', times: 6, period: 'week' }, '6 times a week'],
    [{ kind: 'flexible', times: 1, period: 'twoWeeks' }, 'Every two weeks'],
    [{ kind: 'flexible', times: 1, period: 'month' }, 'Once a month'],
  ])('reads %j as "%s"', (schedule, text) => {
    expect(repeatText(schedule)).toBe(text)
  })
})

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
  ])('says %i as %s', (day, text) => {
    expect(ordinal(day)).toBe(text)
  })
})

describe('isFixedDay', () => {
  it('is true for weekly and monthly, false for flexible', () => {
    expect(isFixedDay({ kind: 'weekly', weekday: 'tuesday' })).toBe(true)
    expect(isFixedDay({ kind: 'monthly', dayOfMonth: 1 })).toBe(true)
    expect(isFixedDay({ kind: 'flexible', times: 1, period: 'week' })).toBe(false)
    expect(isFixedDay({ kind: 'flexible', times: 1, period: 'month' })).toBe(false)
  })
})
