import { describe, expect, it } from 'vitest'
import { addDays, fromLocalDay, mondayOf, mondayOfDay, toLocalDay } from './dates.ts'

describe('toLocalDay', () => {
  it('uses the local date, not UTC, late in the evening', () => {
    expect(toLocalDay(new Date(2026, 10, 11, 23, 30))).toBe('2026-11-11')
  })

  it('uses the local date just after midnight', () => {
    expect(toLocalDay(new Date(2026, 10, 12, 0, 5))).toBe('2026-11-12')
  })
})

describe('mondayOf', () => {
  it('returns the same day for a Monday', () => {
    expect(toLocalDay(mondayOf(new Date(2026, 10, 9, 8)))).toBe('2026-11-09')
  })

  it('goes back to Monday from a Sunday', () => {
    expect(toLocalDay(mondayOf(new Date(2026, 10, 15, 22)))).toBe('2026-11-09')
  })
})

describe('mondayOfDay', () => {
  it("gives a day's Monday as a day", () => {
    expect(mondayOfDay('2026-11-09')).toBe('2026-11-09')
    expect(mondayOfDay('2026-11-11')).toBe('2026-11-09')
    expect(mondayOfDay('2026-11-15')).toBe('2026-11-09')
  })

  it('goes back across a year end', () => {
    expect(mondayOfDay('2027-01-01')).toBe('2026-12-28')
  })
})

describe('addDays', () => {
  it('crosses month ends', () => {
    expect(toLocalDay(addDays(new Date(2026, 10, 30), 1))).toBe('2026-12-01')
  })
})

describe('fromLocalDay', () => {
  it('reads a local day string as local midnight, the inverse of toLocalDay', () => {
    const date = fromLocalDay('2026-11-30')

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 30, 0])
    expect(toLocalDay(fromLocalDay('2026-12-01'))).toBe('2026-12-01')
  })
})
