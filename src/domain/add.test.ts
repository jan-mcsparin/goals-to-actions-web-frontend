import { describe, expect, it } from 'vitest'
import { GOAL_DEFAULTS } from '../test/goals.ts'
import type { Aspiration, Goal, RecurringItem, Schedule } from '../api/types.ts'
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
  MONTH_DAY_OPTIONS,
  NEW_ASPIRATION,
  needsLineField,
  recurringDraftOf,
  recurringEditInput,
  recurringEditReady,
  recurringInput,
  recurringReady,
  scheduleOf,
  splitGoalSentence,
  taskConfirmation,
  taskInput,
  taskReady,
  WEEKDAY_OPTIONS,
  type GoalDraft,
  type RepeatOption,
} from './add.ts'
import { repeatText } from './recurring.ts'

const WEDNESDAY = '2026-11-11'
const THIS_MONDAY = '2026-11-09'

// taskWeek went: which week a new task goes in is the server's to decide (ADR-008).

describe('taskConfirmation', () => {
  it('confirms a task on today', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: WEDNESDAY, week: THIS_MONDAY }, WEDNESDAY)).toBe('Added to today.')
  })

  it('says which day a task set on a later day is on', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: '2026-11-13', week: THIS_MONDAY }, WEDNESDAY)).toBe('Set for Fri, Nov 13.')
    expect(taskConfirmation({ state: 'open', plannedDay: '2026-12-12', week: '2026-12-07' }, WEDNESDAY)).toBe('Set for Sat, Dec 12.')
  })

  it('names the year of a day set in another year', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: '2027-01-02', week: '2026-12-28' }, WEDNESDAY)).toBe(
      'Set for Sat, Jan 2, 2027.',
    )
  })

  it("confirms a task in this week's bank", () => {
    expect(taskConfirmation({ state: 'open', plannedDay: null, week: THIS_MONDAY }, WEDNESDAY)).toBe("Added to this week's bank.")
  })

  it('confirms a task waiting for a later week', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: null, week: '2026-11-23' }, WEDNESDAY)).toBe('Saved for the week of Nov 23.')
  })

  it('confirms a task due beyond the open weeks, which waits with no week', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: null, week: null }, WEDNESDAY)).toBe("Saved. It joins the week it's due.")
  })

  it('names the year of a later week in another year', () => {
    expect(taskConfirmation({ state: 'open', plannedDay: null, week: '2027-01-04' }, WEDNESDAY)).toBe(
      'Saved for the week of Jan 4, 2027.',
    )
  })
})

describe('taskReady', () => {
  const draft = emptyTaskDraft('inBank')

  it('is ready with a title', () => {
    expect(taskReady({ ...draft, title: 'Fill out my ballot' })).toBe(true)
  })

  it('is not ready with a blank title', () => {
    expect(taskReady({ ...draft, title: '' })).toBe(false)
    expect(taskReady({ ...draft, title: '   ' })).toBe(false)
  })

  it('needs a day on a day', () => {
    const onADay = { ...draft, title: 'Dentist cleaning', placement: 'onADay' } as const
    expect(taskReady(onADay)).toBe(false)
    expect(taskReady({ ...onADay, day: '2026-12-12' })).toBe(true)
  })

  it("doesn't need a day elsewhere, even with one typed", () => {
    expect(taskReady({ ...draft, title: 'Call the vet', placement: 'onToday' })).toBe(true)
  })
})

describe('emptyTaskDraft', () => {
  it('starts blank, in the given place', () => {
    expect(emptyTaskDraft('onToday')).toEqual({
      title: '',
      goalId: '',
      dueDate: '',
      timeKind: '',
      time: '',
      placement: 'onToday',
      day: '',
      atTime: '',
    })
  })
})

describe('taskInput', () => {
  const draft = emptyTaskDraft('inBank')

  it('sends only the title when nothing else is set', () => {
    expect(taskInput({ ...draft, title: 'Fill out my ballot' }, WEDNESDAY)).toEqual({ title: 'Fill out my ballot' })
  })

  it('sends the goal, due date and time of day when set', () => {
    const input = taskInput({ ...draft, title: 'Lift', goalId: 'goal-strong', dueDate: '2026-11-13', timeKind: 'by', time: '18:00' }, WEDNESDAY)

    expect(input).toEqual({
      title: 'Lift',
      goalId: 'goal-strong',
      dueDate: '2026-11-13',
      timeOfDay: { kind: 'by', time: '18:00' },
    })
  })

  it('leaves out a time of day without a time', () => {
    expect(taskInput({ ...draft, title: 'Lift', timeKind: 'at' }, WEDNESDAY).timeOfDay).toBeUndefined()
  })

  it('leaves out a time without "by" or "at"', () => {
    expect(taskInput({ ...draft, title: 'Lift', time: '18:00' }, WEDNESDAY).timeOfDay).toBeUndefined()
  })

  // NewTask is the API's now: "On today" sends today as the day, and the server places it.
  it('sends today as its day when "On today" is chosen', () => {
    expect(taskInput({ ...draft, title: 'Call the vet', placement: 'onToday' }, WEDNESDAY).day).toBe(WEDNESDAY)
  })

  describe('on a day', () => {
    const onADay = { ...draft, title: 'Dentist cleaning', placement: 'onADay', day: '2026-12-12' } as const

    it('sends the day and the goal', () => {
      expect(taskInput({ ...onADay, goalId: 'goal-strong' }, WEDNESDAY)).toEqual({
        title: 'Dentist cleaning',
        goalId: 'goal-strong',
        day: '2026-12-12',
      })
    })

    it('sends its time as "at"', () => {
      expect(taskInput({ ...onADay, atTime: '15:00' }, WEDNESDAY).timeOfDay).toEqual({ kind: 'at', time: '15:00' })
    })

    it('leaves out a due date and time of day typed for the other choices', () => {
      const input = taskInput({ ...onADay, dueDate: '2026-12-01', timeKind: 'by', time: '18:00' }, WEDNESDAY)

      expect(input).toEqual({ title: 'Dentist cleaning', day: '2026-12-12' })
    })
  })

  it("leaves out a day typed for On a day when it's somewhere else", () => {
    expect(taskInput({ ...draft, title: 'Call the vet', day: '2026-12-12', atTime: '15:00' }, WEDNESDAY)).toEqual({
      title: 'Call the vet',
    })
  })
})

describe('goalChoices', () => {
  it('offers the active goals only, by label', () => {
    const goal = (id: string, label: string, status: Goal['status']): Goal => ({
      ...GOAL_DEFAULTS,
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
      target: { sessions: '', unit: '' },
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
    expect(goalReady(draftWith({ target: { sessions: '3', unit: 'lifting sessions' } }), TODAY)).toBe(true)
  })

  it.each([
    ['a number without a unit', { sessions: '3', unit: '' }],
    ['a unit without a number', { sessions: '', unit: 'lifting sessions' }],
    ['zero', { sessions: '0', unit: 'lifting sessions' }],
    ['a fraction', { sessions: '2.5', unit: 'lifting sessions' }],
    ['more than 14', { sessions: '15', unit: 'lifting sessions' }],
  ])('is not ready with a weekly target of %s', (_, target) => {
    expect(goalReady(draftWith({ target }), TODAY)).toBe(false)
  })

  it("ignores a half-typed target on a goal that isn't building, since it isn't shown", () => {
    expect(goalReady(draftWith({ type: 'oneOff', target: { sessions: '3', unit: '' } }), TODAY)).toBe(true)
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
    const aspiration = (id: string, name: string, position?: number): Aspiration => ({
      id,
      name,
      why: null,
      position: position ?? null,
      retiredOn: position ? null : '2026-10-15',
      status: position ? 'active' : 'retired',
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
      target: { sessions: ' 3 ', unit: ' lifting sessions ' },
    }

    expect(goalInput(draft, TODAY)).toEqual({
      label: 'Be strong',
      measurableLine: 'bench 175',
      type: 'building',
      aspirationId: 'asp-fit',
      baseline: 'bench 155',
      deadline: '2027-06-01',
      weeklyTarget: { kind: 'count', sessions: 3, amount: null, unit: 'lifting sessions' },
    })
  })

  it('leaves out a new aspiration, which is saved first', () => {
    expect(goalInput({ ...building, aspirationId: NEW_ASPIRATION, newAspirationName: 'Be fit' }, TODAY).aspirationId).toBeUndefined()
  })

  it("leaves out a target and start date a goal's type doesn't show", () => {
    const draft = { ...building, type: 'oneOff' as const, target: { sessions: '3', unit: 'sessions' }, startDate: '2026-11-20' }

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

  it('reads each option back as the schedule it labels', () => {
    const texts = (options: RepeatOption[]) => options.map((option) => repeatText(scheduleOf(option.value)))
    expect(texts(WEEKDAY_OPTIONS)).toEqual(WEEKDAY_OPTIONS.map((option) => `Every ${option.label}`))
    expect(texts(MONTH_DAY_OPTIONS)).toEqual(MONTH_DAY_OPTIONS.map((option) => `Monthly on the ${option.label}`))
    expect(texts(FLEXIBLE_OPTIONS)).toEqual(FLEXIBLE_OPTIONS.map((option) => option.label))
    expect(scheduleOf(WEEKDAY_OPTIONS[1].value)).toEqual({ kind: 'weekly', weekday: 'tuesday' })
    expect(scheduleOf(MONTH_DAY_OPTIONS[0].value)).toEqual({ kind: 'monthly', dayOfMonth: 1 })
    expect(scheduleOf(FLEXIBLE_OPTIONS[2].value)).toEqual({ kind: 'flexible', times: 3, period: 'week' })
    expect(scheduleOf(FLEXIBLE_OPTIONS[6].value)).toEqual({ kind: 'flexible', times: 1, period: 'twoWeeks' })
  })

  it('refuses a value that is not an option', () => {
    expect(() => scheduleOf('weekly:funday')).toThrow()
  })
})

describe('recurringInput', () => {
  it('starts fixed on Monday, flexible once a week, under the aspiration it was opened for', () => {
    const draft = emptyRecurringDraft('asp-fit')
    expect(draft).toMatchObject({ name: '', fixedDay: true, aspirationId: 'asp-fit' })
    expect(scheduleOf(draft.fixed)).toEqual({ kind: 'weekly', weekday: 'monday' })
    expect(scheduleOf(draft.flexible)).toEqual({ kind: 'flexible', times: 1, period: 'week' })
    expect(emptyRecurringDraft().aspirationId).toBe('')
  })

  it('saves a fixed day as its schedule, due from today, on Keep life running', () => {
    const draft = { ...emptyRecurringDraft(), name: 'Take out the trash', fixed: WEEKDAY_OPTIONS[1].value }
    expect(recurringInput(draft, WEDNESDAY)).toEqual({
      name: 'Take out the trash',
      aspirationId: null,
      schedule: { kind: 'weekly', weekday: 'tuesday' },
      startsOn: WEDNESDAY,
    })
  })

  it('saves a flexible choice, due from today, under its aspiration', () => {
    const draft = {
      ...emptyRecurringDraft('asp-fit'),
      name: 'Stretch',
      fixedDay: false,
      flexible: FLEXIBLE_OPTIONS[2].value,
    }
    expect(recurringInput(draft, WEDNESDAY)).toEqual({
      name: 'Stretch',
      aspirationId: 'asp-fit',
      schedule: { kind: 'flexible', times: 3, period: 'week' },
      startsOn: WEDNESDAY,
    })
  })
})

describe('editing a recurring item', () => {
  const trash: RecurringItem = {
    id: 'rec-trash',
    name: 'Take out the trash',
    aspirationId: 'asp-home',
    fromGoalId: null,
    schedule: { kind: 'weekly', weekday: 'tuesday' },
    startsOn: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T09:00:00Z',
  }

  const schedules: Schedule[] = [
    { kind: 'weekly', weekday: 'sunday' },
    { kind: 'monthly', dayOfMonth: 28 },
    ...FLEXIBLE_OPTIONS.map((option) => scheduleOf(option.value)),
  ]

  it.each(schedules.map((schedule) => [repeatText(schedule), schedule] as const))(
    'fills the form from %s and sends the same schedule back',
    (_text, schedule) => {
      const item = { ...trash, schedule }

      expect(recurringEditInput(recurringDraftOf(item), item).schedule).toEqual(schedule)
    },
  )

  it('fills in the name, Fixed day or Flexible, and the aspiration', () => {
    expect(recurringDraftOf(trash)).toMatchObject({ name: 'Take out the trash', fixedDay: true, aspirationId: 'asp-home' })
    expect(recurringDraftOf({ ...trash, aspirationId: null, schedule: { kind: 'flexible', times: 2, period: 'week' } })).toMatchObject({
      fixedDay: false,
      aspirationId: '',
    })
  })

  it('keeps the start it has, and sends no goal it came from', () => {
    const fromAGoal = { ...trash, fromGoalId: 'goal-strong' }
    const draft = { ...recurringDraftOf(fromAGoal), name: '  Trash and recycling ', fixed: WEEKDAY_OPTIONS[2].value, aspirationId: '' }

    expect(recurringEditInput(draft, fromAGoal)).toEqual({
      name: 'Trash and recycling',
      aspirationId: null,
      schedule: { kind: 'weekly', weekday: 'wednesday' },
      startsOn: '2026-10-01',
    })
  })

  it('is ready to save only once something has changed', () => {
    const draft = recurringDraftOf(trash)

    expect(recurringEditReady(draft, trash)).toBe(false)
    expect(recurringEditReady({ ...draft, name: 'Trash and recycling' }, trash)).toBe(true)
    expect(recurringEditReady({ ...draft, fixed: WEEKDAY_OPTIONS[3].value }, trash)).toBe(true)
    expect(recurringEditReady({ ...draft, fixedDay: false }, trash)).toBe(true)
    expect(recurringEditReady({ ...draft, aspirationId: '' }, trash)).toBe(true)
  })

  it('counts neither spaces round the name nor the other picker as a change', () => {
    const draft = recurringDraftOf(trash)

    expect(recurringEditReady({ ...draft, name: ' Take out the trash ' }, trash)).toBe(false)
    expect(recurringEditReady({ ...draft, flexible: FLEXIBLE_OPTIONS[3].value }, trash)).toBe(false)
  })

  it('needs a name', () => {
    expect(recurringEditReady({ ...recurringDraftOf(trash), name: '  ' }, trash)).toBe(false)
  })
})
