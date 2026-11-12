import { describe, expect, it } from 'vitest'
import type { Aspiration, Goal } from '../api/types.ts'
import {
  aspirationChoices,
  aspirationReady,
  emptyGoalDraft,
  emptyRecurringDraft,
  FLEXIBLE_OPTIONS,
  emptyTaskDraft,
  goalChoices,
  goalConfirmation,
  goalInput,
  goalParts,
  goalReady,
  isFixedDay,
  MONTH_DAY_OPTIONS,
  NEW_ASPIRATION,
  needsLineField,
  nextDue,
  recurringInput,
  recurringReady,
  repeatChoice,
  repeatRuleText,
  splitGoalSentence,
  taskConfirmation,
  taskInput,
  taskReady,
  taskWeek,
  WEEKDAY_OPTIONS,
  type GoalDraft,
  type RepeatChoice,
  type RepeatOption,
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

describe('repeatRuleText', () => {
  it.each<[RepeatChoice, string]>([
    [{ kind: 'weekday', weekday: 2 }, 'Every Tuesday'],
    [{ kind: 'weekday', weekday: 0 }, 'Every Sunday'],
    [{ kind: 'monthDay', day: 1 }, 'Monthly on the 1st'],
    [{ kind: 'monthDay', day: 2 }, 'Monthly on the 2nd'],
    [{ kind: 'monthDay', day: 3 }, 'Monthly on the 3rd'],
    [{ kind: 'monthDay', day: 11 }, 'Monthly on the 11th'],
    [{ kind: 'monthDay', day: 12 }, 'Monthly on the 12th'],
    [{ kind: 'monthDay', day: 13 }, 'Monthly on the 13th'],
    [{ kind: 'monthDay', day: 21 }, 'Monthly on the 21st'],
    [{ kind: 'monthDay', day: 22 }, 'Monthly on the 22nd'],
    [{ kind: 'monthDay', day: 23 }, 'Monthly on the 23rd'],
    [{ kind: 'monthDay', day: 28 }, 'Monthly on the 28th'],
    [{ kind: 'timesAWeek', times: 1 }, 'Once a week'],
    [{ kind: 'timesAWeek', times: 3 }, '3 times a week'],
    [{ kind: 'timesAWeek', times: 6 }, '6 times a week'],
    [{ kind: 'everyTwoWeeks' }, 'Every two weeks'],
    [{ kind: 'onceAMonth' }, 'Once a month'],
  ])('reads %j as "%s"', (choice, text) => {
    expect(repeatRuleText(choice)).toBe(text)
  })
})

describe('isFixedDay', () => {
  it('is true for a weekday or a day of the month, false for flexible choices', () => {
    expect(isFixedDay({ kind: 'weekday', weekday: 2 })).toBe(true)
    expect(isFixedDay({ kind: 'monthDay', day: 1 })).toBe(true)
    expect(isFixedDay({ kind: 'timesAWeek', times: 1 })).toBe(false)
    expect(isFixedDay({ kind: 'everyTwoWeeks' })).toBe(false)
    expect(isFixedDay({ kind: 'onceAMonth' })).toBe(false)
  })
})

describe('nextDue', () => {
  it.each([
    ['later this week', 5, '2026-11-13'],
    ['on Sunday, the end of this week', 0, '2026-11-15'],
    ['earlier in the week, so next week', 2, '2026-11-17'],
    ['on Monday, so next week', 1, '2026-11-16'],
    ["on today's weekday, so today", 3, WEDNESDAY],
  ])('gives a weekday %s', (_case, weekday, due) => {
    expect(nextDue({ kind: 'weekday', weekday }, WEDNESDAY)).toBe(due)
  })

  it.each([
    ['later this month', 28, '2026-11-28'],
    ["today's day of the month, so today", 11, WEDNESDAY],
    ['already past this month, so next month', 1, '2026-12-01'],
  ])('gives a monthly day %s', (_case, day, due) => {
    expect(nextDue({ kind: 'monthDay', day }, WEDNESDAY)).toBe(due)
  })

  it('gives a monthly day already past in December in January', () => {
    expect(nextDue({ kind: 'monthDay', day: 1 }, '2026-12-15')).toBe('2027-01-01')
  })

  it.each<RepeatChoice>([{ kind: 'timesAWeek', times: 1 }, { kind: 'timesAWeek', times: 4 }, { kind: 'everyTwoWeeks' }, { kind: 'onceAMonth' }])(
    'gives today for flexible %j',
    (choice) => {
      expect(nextDue(choice, WEDNESDAY)).toBe(WEDNESDAY)
    },
  )
})

describe('recurringReady', () => {
  it('needs a name', () => {
    expect(recurringReady({ name: '' })).toBe(false)
    expect(recurringReady({ name: '   ' })).toBe(false)
    expect(recurringReady({ name: 'Take out the trash' })).toBe(true)
  })
})

describe('repeat options', () => {
  it('lists the weekdays from Monday, the 1st to the 28th, and the flexible choices', () => {
    expect(WEEKDAY_OPTIONS.map((option) => option.label)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ])
    expect(MONTH_DAY_OPTIONS).toHaveLength(28)
    expect(MONTH_DAY_OPTIONS[0].label).toBe('1st')
    expect(MONTH_DAY_OPTIONS[27].label).toBe('28th')
    expect(FLEXIBLE_OPTIONS.map((option) => option.label)).toEqual([
      'Once a week', '2 times a week', '3 times a week', '4 times a week', '5 times a week', '6 times a week',
      'Every two weeks', 'Once a month',
    ])
  })

  it('reads each option back as its choice', () => {
    const rules = (options: RepeatOption[]) => options.map((option) => repeatRuleText(repeatChoice(option.value)))
    expect(rules(WEEKDAY_OPTIONS)).toEqual(WEEKDAY_OPTIONS.map((option) => `Every ${option.label}`))
    expect(rules(MONTH_DAY_OPTIONS)).toEqual(MONTH_DAY_OPTIONS.map((option) => `Monthly on the ${option.label}`))
    expect(rules(FLEXIBLE_OPTIONS)).toEqual(FLEXIBLE_OPTIONS.map((option) => option.label))
    expect(repeatChoice(WEEKDAY_OPTIONS[1].value)).toEqual({ kind: 'weekday', weekday: 2 })
    expect(repeatChoice(MONTH_DAY_OPTIONS[0].value)).toEqual({ kind: 'monthDay', day: 1 })
    expect(repeatChoice(FLEXIBLE_OPTIONS[2].value)).toEqual({ kind: 'timesAWeek', times: 3 })
  })
})

describe('recurringInput', () => {
  it('starts fixed on Monday, flexible once a week, under the aspiration it was opened for', () => {
    const draft = emptyRecurringDraft('asp-fit')
    expect(draft).toMatchObject({ name: '', fixedDay: true, aspirationId: 'asp-fit' })
    expect(repeatChoice(draft.fixed)).toEqual({ kind: 'weekday', weekday: 1 })
    expect(repeatChoice(draft.flexible)).toEqual({ kind: 'timesAWeek', times: 1 })
    expect(emptyRecurringDraft().aspirationId).toBe('')
  })

  it('saves a fixed day with its rule and next due date', () => {
    const draft = { ...emptyRecurringDraft(), name: 'Take out the trash', fixed: WEEKDAY_OPTIONS[1].value }
    expect(recurringInput(draft, WEDNESDAY)).toEqual({
      name: 'Take out the trash',
      repeatRule: 'Every Tuesday',
      fixedDay: true,
      nextDue: '2026-11-17',
    })
  })

  it('saves a flexible choice as due today, under its aspiration', () => {
    const draft = {
      ...emptyRecurringDraft('asp-fit'),
      name: 'Stretch',
      fixedDay: false,
      flexible: FLEXIBLE_OPTIONS[2].value,
    }
    expect(recurringInput(draft, WEDNESDAY)).toEqual({
      name: 'Stretch',
      repeatRule: '3 times a week',
      fixedDay: false,
      nextDue: WEDNESDAY,
      aspirationId: 'asp-fit',
    })
  })
})
