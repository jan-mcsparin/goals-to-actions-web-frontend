import { describe, expect, it } from 'vitest'
import { countTarget } from '../test/goals.ts'
import type { Task, Week, WeekGoal } from '../api/types.ts'
import { daySummaries, pacingLine, pickableDays, weekProgress, weekRange, wrapUpLists } from './week.ts'
import { aTask } from '../test/tasks.ts'

const MONDAY = '2026-11-09'
const WEDNESDAY = '2026-11-11'

function task(id: string, plannedDay: string | undefined, fields: Partial<Task> = {}): Task {
  return aTask(id, { week: MONDAY, plannedDay: plannedDay ?? null, ...fields })
}

const fit = { id: 'asp-fit', name: 'Be fit', position: 1 }
const lifting = countTarget('goal-strong', 3, 'lifting sessions')

// A bar on Week as the API sends it: the goal's target that week and how far along it is.
function weekGoal(id: string, label: string, aspiration: WeekGoal['aspiration'], done = 0): WeekGoal {
  const { goalId: _goalId, ...weeklyTarget } = { ...lifting, goalId: id }
  return { id, label, aspiration, weeklyTarget, progress: { done, of: weeklyTarget.sessions } }
}

const strong = weekGoal('goal-strong', 'Be strong', fit)

function week(tasks: Task[], goals: WeekGoal[] = [strong]): Week {
  return { week: MONDAY, isCurrent: true, nextWeekOpen: false, tasks, goals, days: [], quittingGoals: [] }
}

describe('pacingLine', () => {
  it.each([
    [{ done: 3, plannedAhead: 0, target: 3, daysLeft: 5 }, 'Done for the week'],
    [{ done: 1, plannedAhead: 2, target: 3, daysLeft: 6 }, '6 days left · on pace'],
    [{ done: 1, plannedAhead: 1, target: 3, daysLeft: 6 }, '6 days left · 1 more to plan'],
    [{ done: 0, plannedAhead: 0, target: 3, daysLeft: 1 }, '1 day left · 3 more to plan'],
  ])('%o → %s', (pacing, expected) => {
    expect(pacingLine(pacing)).toBe(expected)
  })
})

describe('weekProgress', () => {
  // Done and the target are the API's (the week's goals); only the pacing is worked out here.
  it("takes the goal's progress from the week and paces against the rest of the week", () => {
    const plan = week(
      [
        task('Lift Mon', MONDAY, { goalId: 'goal-strong', state: 'done' }),
        task('Lift Tue', '2026-11-10', { goalId: 'goal-strong' }),
        task('Lift Wed', WEDNESDAY, { goalId: 'goal-strong' }),
        task('Lift bank', undefined, { goalId: 'goal-strong' }),
      ],
      [weekGoal('goal-strong', 'Be strong', fit, 1)],
    )

    expect(weekProgress(plan, WEDNESDAY)).toEqual([
      { goalId: 'goal-strong', title: 'Be strong · Be fit', done: 1, target: 3, pacing: '5 days left · 1 more to plan' },
    ])
  })

  it('shows a goal with a target even when it has no tasks this week', () => {
    expect(weekProgress(week([]), WEDNESDAY)).toEqual([
      { goalId: 'goal-strong', title: 'Be strong · Be fit', done: 0, target: 3, pacing: '5 days left · 3 more to plan' },
    ])
  })

  it('titles a goal with no aspiration by its label alone', () => {
    const [row] = weekProgress(week([], [weekGoal('goal-read', 'Read more', null)]), WEDNESDAY)

    expect(row.title).toBe('Read more')
  })

  it('orders goals by aspiration priority, as the By goal view does; retired and none go last', () => {
    const builder = { id: 'asp-build', name: 'Be a builder', position: 0 }
    const retired = { id: 'asp-old', name: 'Old', position: null }
    const plan = week([], [
      weekGoal('goal-read', 'Read more', null),
      weekGoal('goal-old', 'Old goal', retired),
      strong,
      weekGoal('goal-proto', 'Prototype', builder),
    ])

    expect(weekProgress(plan, WEDNESDAY).map((row) => row.goalId)).toEqual(['goal-proto', 'goal-strong', 'goal-read', 'goal-old'])
  })
})

describe('daySummaries', () => {
  const plan = week([
    task('Lift', MONDAY, { state: 'done' }),
    task('Laundry', MONDAY, { state: 'done' }),
    task('Take out the trash', '2026-11-10', { timeOfDay: { kind: 'by', time: '07:00' }, recurringItemId: 'rec-trash', fixedDay: true }),
    task('Pay rent', '2026-11-10'),
    task('Lift: bench day', WEDNESDAY, { timeOfDay: { kind: 'at', time: '18:00' } }),
    task('Back in the bank', undefined),
    task('In the bank', undefined),
  ])
  const days = daySummaries(plan, WEDNESDAY)

  it('lists Monday to Sunday', () => {
    expect(days.map((day) => day.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('summarises each day in day order, with time labels', () => {
    expect(days.map((day) => day.summary)).toEqual([
      'Lift · Laundry',
      'Take out the trash by 7 a.m. · Pay rent',
      'Lift: bench day at 6 p.m.',
      'Free day',
      'Free day',
      'Free day',
      'Free day',
    ])
  })

  it('marks done days, today and past days', () => {
    expect(days.map((day) => day.allDone)).toEqual([true, false, false, false, false, false, false])
    expect(days.map((day) => day.isToday)).toEqual([false, false, true, false, false, false, false])
    expect(days.map((day) => day.isPast)).toEqual([true, true, false, false, false, false, false])
  })

  it("marks a day full when the week read says so, whatever's on it", () => {
    const marks = [
      { day: '2026-11-10', cap: 3, full: true },
      { day: '2026-11-12', cap: 3, full: false },
    ]
    const full = daySummaries({ ...plan, days: marks }, WEDNESDAY).map((day) => day.full)
    expect(full).toEqual([false, true, false, false, false, false, false])
  })
})

describe('weekRange', () => {
  it.each([
    ['2026-11-09', 'Nov 9–15'],
    ['2026-11-30', 'Nov 30–Dec 6'],
    ['2026-12-28', 'Dec 28–Jan 3'],
  ])('%s → %s', (weekOf, expected) => {
    expect(weekRange(weekOf)).toBe(expected)
  })
})

describe('pickableDays', () => {
  it('offers today and the later days of the week', () => {
    expect(pickableDays(MONDAY, WEDNESDAY)).toEqual([
      { date: '2026-11-11', label: 'Today' },
      { date: '2026-11-12', label: 'Thursday' },
      { date: '2026-11-13', label: 'Friday' },
      { date: '2026-11-14', label: 'Saturday' },
      { date: '2026-11-15', label: 'Sunday' },
    ])
  })

  it('offers only Sunday on a Sunday', () => {
    expect(pickableDays(MONDAY, '2026-11-15')).toEqual([{ date: '2026-11-15', label: 'Today' }])
  })
})

describe('wrapUpLists', () => {
  it("sorts a week's unfinished tasks by what closing does to them, in the order given", () => {
    const plan = week([
      task('mow', undefined, { atClose: 'carriesOver' }),
      task('lift', '2026-11-12', { atClose: 'ends' }),
      task('call', '2026-11-13', { atClose: 'carriesOver' }),
      task('run', undefined, { atClose: 'ends' }),
      task('done', '2026-11-10', { state: 'done', atClose: null }),
    ])

    const { carriesOver, ends } = wrapUpLists(plan)

    expect(carriesOver.map((item) => item.id)).toEqual(['mow', 'call'])
    expect(ends.map((item) => item.id)).toEqual(['lift', 'run'])
  })

  it('has two empty lists when everything is done', () => {
    expect(wrapUpLists(week([task('done', '2026-11-10', { state: 'done' })]))).toEqual({ carriesOver: [], ends: [] })
  })
})
