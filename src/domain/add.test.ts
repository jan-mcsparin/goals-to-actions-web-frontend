import { describe, expect, it } from 'vitest'
import { taskConfirmation, taskReady, taskWeek } from './add.ts'

const WEDNESDAY = '2026-11-11'
const THIS_MONDAY = '2026-11-09'

describe('taskWeek', () => {
  it('puts a task with no due date in this week', () => {
    expect(taskWeek(undefined, WEDNESDAY)).toBe(THIS_MONDAY)
  })

  it('puts a task due this week in this week', () => {
    expect(taskWeek('2026-11-15', WEDNESDAY)).toBe(THIS_MONDAY)
  })

  it('puts a task due in the past in this week', () => {
    expect(taskWeek('2026-10-20', WEDNESDAY)).toBe(THIS_MONDAY)
  })

  it('puts a task due next week in that week', () => {
    expect(taskWeek('2026-11-16', WEDNESDAY)).toBe('2026-11-16')
    expect(taskWeek('2026-11-22', WEDNESDAY)).toBe('2026-11-16')
  })

  it('puts a task due across the year end in that week', () => {
    expect(taskWeek('2027-01-01', WEDNESDAY)).toBe('2026-12-28')
  })
})

describe('taskConfirmation', () => {
  it('confirms a task on today', () => {
    expect(taskConfirmation({ status: 'planned', weekOf: THIS_MONDAY }, WEDNESDAY)).toBe('Added to today.')
  })

  it("confirms a task in this week's bank", () => {
    expect(taskConfirmation({ status: 'inBank', weekOf: THIS_MONDAY }, WEDNESDAY)).toBe("Added to this week's bank.")
  })

  it('confirms a task waiting for a later week', () => {
    expect(taskConfirmation({ status: 'inBank', weekOf: '2026-11-23' }, WEDNESDAY)).toBe('Saved for the week of Nov 23.')
  })

  it('names the year of a later week in another year', () => {
    expect(taskConfirmation({ status: 'inBank', weekOf: '2027-01-04' }, WEDNESDAY)).toBe(
      'Saved for the week of Jan 4, 2027.',
    )
  })
})

describe('taskReady', () => {
  it('is ready with a title', () => {
    expect(taskReady({ title: 'Fill out my ballot' })).toBe(true)
  })

  it('is not ready with a blank title', () => {
    expect(taskReady({ title: '' })).toBe(false)
    expect(taskReady({ title: '   ' })).toBe(false)
  })
})
