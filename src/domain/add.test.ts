import { describe, expect, it } from 'vitest'
import type { Goal } from '../api/types.ts'
import { emptyTaskDraft, goalChoices, taskConfirmation, taskInput, taskReady, taskWeek } from './add.ts'

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

describe('emptyTaskDraft', () => {
  it('starts blank, in the given place', () => {
    expect(emptyTaskDraft('onToday')).toEqual({ title: '', goalId: '', dueDate: '', timeKind: '', time: '', placement: 'onToday' })
  })
})

describe('taskInput', () => {
  const draft = emptyTaskDraft('inBank')

  it('sends only the title when nothing else is set', () => {
    expect(taskInput({ ...draft, title: 'Fill out my ballot' })).toEqual({ title: 'Fill out my ballot', onToday: false })
  })

  it('sends the goal, due date and time of day when set', () => {
    const input = taskInput({ ...draft, title: 'Lift', goalId: 'goal-strong', dueDate: '2026-11-13', timeKind: 'by', time: '18:00' })

    expect(input).toEqual({
      title: 'Lift',
      goalId: 'goal-strong',
      dueDate: '2026-11-13',
      timeOfDay: { kind: 'by', time: '18:00' },
      onToday: false,
    })
  })

  it('leaves out a time of day without a time', () => {
    expect(taskInput({ ...draft, title: 'Lift', timeKind: 'at' }).timeOfDay).toBeUndefined()
  })

  it('leaves out a time without "by" or "at"', () => {
    expect(taskInput({ ...draft, title: 'Lift', time: '18:00' }).timeOfDay).toBeUndefined()
  })

  it('puts it on today when "On today" is chosen', () => {
    expect(taskInput({ ...draft, title: 'Call the vet', placement: 'onToday' }).onToday).toBe(true)
  })
})

describe('goalChoices', () => {
  it('offers the active goals only, by label', () => {
    const goal = (id: string, label: string, status: Goal['status']): Goal => ({
      id,
      label,
      measurableLine: '-',
      type: 'building',
      status,
      startDate: '2026-10-01',
    })
    const goals = [goal('g1', 'Be strong', 'active'), goal('g2', 'Quit sugar', 'paused'), goal('g3', 'Clear the garage', 'active'), goal('g4', 'Run a 10k', 'reached')]

    expect(goalChoices(goals)).toEqual([
      { id: 'g1', label: 'Be strong' },
      { id: 'g3', label: 'Clear the garage' },
    ])
  })
})
