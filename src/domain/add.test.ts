import { describe, expect, it } from 'vitest'
import type { Aspiration, Goal } from '../api/types.ts'
import {
  aspirationChoices,
  aspirationReady,
  emptyGoalDraft,
  emptyTaskDraft,
  goalChoices,
  goalConfirmation,
  goalInput,
  goalParts,
  goalReady,
  NEW_ASPIRATION,
  needsLineField,
  splitGoalSentence,
  taskConfirmation,
  taskInput,
  taskReady,
  taskWeek,
  type GoalDraft,
} from './add.ts'

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

describe('splitGoalSentence', () => {
  it('splits at the colon into the label and the measurable line', () => {
    expect(splitGoalSentence('Be strong: bench 175, squat 350, deadlift 400')).toEqual({
      label: 'Be strong',
      measurableLine: 'bench 175, squat 350, deadlift 400',
    })
  })

  it('splits at the first colon only', () => {
    expect(splitGoalSentence('Run: a 10k in 0:55')).toEqual({ label: 'Run', measurableLine: 'a 10k in 0:55' })
  })

  it('makes the whole sentence the label when there is no colon', () => {
    expect(splitGoalSentence('Quit sugar')).toEqual({ label: 'Quit sugar', measurableLine: '' })
  })

  it('trims extra spaces', () => {
    expect(splitGoalSentence('   Be strong   :   bench 175   ')).toEqual({ label: 'Be strong', measurableLine: 'bench 175' })
  })
})

describe('needsLineField', () => {
  it('asks for the line on its own when the sentence has no colon', () => {
    expect(needsLineField('Quit sugar')).toBe(true)
    expect(needsLineField('')).toBe(true)
  })

  it("doesn't once there's a colon, even before the line is typed", () => {
    expect(needsLineField('Be strong:')).toBe(false)
  })
})

describe('goalParts', () => {
  it('takes the line from the sentence when it has a colon', () => {
    const draft = { ...emptyGoalDraft(), sentence: 'Be strong: bench 175', measurableLine: 'ignored' }

    expect(goalParts(draft)).toEqual({ label: 'Be strong', measurableLine: 'bench 175' })
  })

  it('takes the line from the second field when the sentence has no colon', () => {
    const draft = { ...emptyGoalDraft(), sentence: 'Quit sugar', measurableLine: '  no sweets for 30 days ' }

    expect(goalParts(draft)).toEqual({ label: 'Quit sugar', measurableLine: 'no sweets for 30 days' })
  })
})

describe('emptyGoalDraft', () => {
  it('starts with no type picked and nothing typed', () => {
    expect(emptyGoalDraft()).toEqual({
      type: undefined,
      sentence: '',
      measurableLine: '',
      aspirationId: '',
      newAspirationName: '',
      baseline: '',
      target: { amount: '', unit: '' },
      startDate: '',
      deadline: '',
    })
  })
})

describe('goalReady', () => {
  const TODAY = '2026-11-11'
  const ready: GoalDraft = { ...emptyGoalDraft(), type: 'building', sentence: 'Be strong: bench 175' }
  const draftWith = (changes: Partial<GoalDraft>): GoalDraft => ({ ...ready, ...changes })

  it('is ready with a type, a label and a line', () => {
    expect(goalReady(ready, TODAY)).toBe(true)
  })

  it('is ready with the line in the second field', () => {
    expect(goalReady(draftWith({ sentence: 'Quit sugar', measurableLine: 'no sweets for 30 days' }), TODAY)).toBe(true)
  })

  it('is not ready before a type is picked', () => {
    expect(goalReady(draftWith({ type: undefined }), TODAY)).toBe(false)
  })

  it.each([
    ['a blank sentence', { sentence: '   ' }],
    ['a blank label', { sentence: ' : bench 175' }],
    ['a blank line after the colon', { sentence: 'Be strong:  ' }],
    ['no colon and a blank second field', { sentence: 'Be strong', measurableLine: '  ' }],
  ])('is not ready with %s', (_, changes) => {
    expect(goalReady(draftWith(changes), TODAY)).toBe(false)
  })

  it('is ready with a whole weekly target and a unit', () => {
    expect(goalReady(draftWith({ target: { amount: '3', unit: 'lifting sessions' } }), TODAY)).toBe(true)
  })

  it.each([
    ['a number without a unit', { amount: '3', unit: '' }],
    ['a unit without a number', { amount: '', unit: 'lifting sessions' }],
    ['zero', { amount: '0', unit: 'lifting sessions' }],
    ['a fraction', { amount: '2.5', unit: 'lifting sessions' }],
  ])('is not ready with a weekly target of %s', (_, target) => {
    expect(goalReady(draftWith({ target }), TODAY)).toBe(false)
  })

  it("ignores a half-typed target on a goal that isn't building, since it isn't shown", () => {
    expect(goalReady(draftWith({ type: 'oneOff', target: { amount: '3', unit: '' } }), TODAY)).toBe(true)
  })

  it('is ready with a deadline on or after today', () => {
    expect(goalReady(draftWith({ deadline: TODAY }), TODAY)).toBe(true)
  })

  it('is not ready with a deadline before today', () => {
    expect(goalReady(draftWith({ deadline: '2026-11-10' }), TODAY)).toBe(false)
  })

  it("measures a quitting goal's deadline from its start date", () => {
    const quitting = draftWith({ type: 'quitting', startDate: '2026-11-20' })

    expect(goalReady({ ...quitting, deadline: '2026-11-19' }, TODAY)).toBe(false)
    expect(goalReady({ ...quitting, deadline: '2026-11-20' }, TODAY)).toBe(true)
  })

  it('needs a name for a new aspiration', () => {
    expect(goalReady(draftWith({ aspirationId: NEW_ASPIRATION, newAspirationName: '  ' }), TODAY)).toBe(false)
    expect(goalReady(draftWith({ aspirationId: NEW_ASPIRATION, newAspirationName: 'Be fit' }), TODAY)).toBe(true)
  })
})

describe('aspirationReady', () => {
  it('is ready with a name, with or without a why', () => {
    expect(aspirationReady({ name: 'Be fit', why: '' })).toBe(true)
  })

  it('is not ready with a blank name', () => {
    expect(aspirationReady({ name: '   ', why: 'So I can keep skiing' })).toBe(false)
  })
})

describe('aspirationChoices', () => {
  it('offers the active aspirations only, in priority order', () => {
    const aspiration = (id: string, name: string, priority?: number): Aspiration => ({
      id,
      name,
      priority,
      status: priority ? 'active' : 'retired',
      createdAt: '2026-10-01T09:00:00Z',
    })
    const aspirations = [aspiration('a2', 'Keep a calm home', 2), aspiration('a3', 'Speak Spanish'), aspiration('a1', 'Be fit', 1)]

    expect(aspirationChoices(aspirations)).toEqual([
      { id: 'a1', label: 'Be fit' },
      { id: 'a2', label: 'Keep a calm home' },
    ])
  })
})

describe('goalInput', () => {
  const TODAY = '2026-11-11'
  const building = { ...emptyGoalDraft(), type: 'building' as const, sentence: ' Be strong :  bench 175 ' }

  it('sends the label, line and type only when nothing else is set', () => {
    expect(goalInput(building, TODAY)).toEqual({ label: 'Be strong', measurableLine: 'bench 175', type: 'building' })
  })

  it('sends the line from the second field when the sentence has no colon', () => {
    const draft = { ...building, sentence: 'Be strong', measurableLine: 'bench 175' }

    expect(goalInput(draft, TODAY)).toMatchObject({ label: 'Be strong', measurableLine: 'bench 175' })
  })

  it('sends the aspiration, baseline, deadline and weekly target when set', () => {
    const draft = {
      ...building,
      aspirationId: 'asp-fit',
      baseline: ' bench 155 ',
      deadline: '2027-06-01',
      target: { amount: ' 3 ', unit: ' lifting sessions ' },
    }

    expect(goalInput(draft, TODAY)).toEqual({
      label: 'Be strong',
      measurableLine: 'bench 175',
      type: 'building',
      aspirationId: 'asp-fit',
      baseline: 'bench 155',
      deadline: '2027-06-01',
      weeklyTarget: { amount: 3, unit: 'lifting sessions' },
    })
  })

  it('leaves out a new aspiration, which is saved first', () => {
    expect(goalInput({ ...building, aspirationId: NEW_ASPIRATION, newAspirationName: 'Be fit' }, TODAY).aspirationId).toBeUndefined()
  })

  it("leaves out a target and start date a goal's type doesn't show", () => {
    const draft = { ...building, type: 'oneOff' as const, target: { amount: '3', unit: 'sessions' }, startDate: '2026-11-20' }

    expect(goalInput(draft, TODAY)).toEqual({ label: 'Be strong', measurableLine: 'bench 175', type: 'oneOff' })
  })

  it("sends a quitting goal's start date, today unless changed", () => {
    const quitting = { ...building, type: 'quitting' as const }

    expect(goalInput(quitting, TODAY).startDate).toBe(TODAY)
    expect(goalInput({ ...quitting, startDate: '2026-11-20' }, TODAY).startDate).toBe('2026-11-20')
  })
})

describe('goalConfirmation', () => {
  it.each([
    ['building', "Saved. Add milestones when you're ready."],
    ['quitting', "Saved. Add milestones when you're ready."],
    ['oneOff', "Saved. Add steps when you're ready."],
  ] as const)('confirms a %s goal', (type, line) => {
    expect(goalConfirmation(type)).toBe(line)
  })
})
