import { describe, expect, it } from 'vitest'
import { countTarget, GOAL_DEFAULTS, type TargetFor, withTargets } from '../test/goals.ts'
import type { Aspiration, Goal, RecurringItem, Task, WeekPlan } from '../api/types.ts'
import { daySummaries, pacingLine, pickableDays, weekProgress, weekRange, wrapUpLists } from './week.ts'
import { aTask } from '../test/tasks.ts'

const MONDAY = '2026-11-09'
const WEDNESDAY = '2026-11-11'

function task(id: string, plannedDay: string | undefined, fields: Partial<Task> = {}): Task {
  return aTask(id, { week: MONDAY, plannedDay: plannedDay ?? null, ...fields })
}

const fit: Aspiration = { id: 'asp-fit', name: 'Be fit', why: null, position: 1, status: 'active', createdAt: '2026-10-01T09:00:00Z', retiredOn: null }
const strong: Goal = {
  ...GOAL_DEFAULTS,
  id: 'goal-strong',
  label: 'Be strong',
  measurableLine: '-',
  type: 'building',
  status: 'active',
  startDate: '2026-10-05',
  aspirationId: 'asp-fit',
}
const reading: Goal = { ...strong, id: 'goal-read', label: 'Read more', aspirationId: null }
const trash: RecurringItem = {
  id: 'rec-trash',
  name: 'Take out the trash',
  aspirationId: null,
  fromGoalId: null,
  schedule: { kind: 'weekly', weekday: 'tuesday' },
  startsOn: '2026-10-01',
  active: true,
  createdAt: '2026-10-01T09:00:00Z',
}
const lifting = countTarget('goal-strong', 3, 'lifting sessions')

// Targets are given per goal and put on their goals.
function week(tasks: Task[], weeklyTargets: TargetFor[] = [lifting]): WeekPlan {
  return { weekOf: MONDAY, isCurrent: true, nextWeekOpen: false, tasks, goals: withTargets([strong, reading], weeklyTargets), aspirations: [fit], recurringItems: [trash] }
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
  it("counts the goal's done tasks and paces against the rest of the week", () => {
    const plan = week([
      task('Lift Mon', MONDAY, { goalId: 'goal-strong', state: 'done' }),
      task('Lift Tue', '2026-11-10', { goalId: 'goal-strong' }),
      task('Lift Wed', WEDNESDAY, { goalId: 'goal-strong' }),
      task('Lift bank', undefined, { goalId: 'goal-strong' }),
      task('Read', WEDNESDAY, { goalId: 'goal-read', state: 'done' }),
    ])

    expect(weekProgress(plan, WEDNESDAY)).toEqual([
      { goalId: 'goal-strong', title: 'Be strong · Be fit', done: 1, target: 3, pacing: '5 days left · 1 more to plan' },
    ])
  })

  it('shows a goal with a target even when it has no tasks this week', () => {
    expect(weekProgress(week([]), WEDNESDAY)).toEqual([
      { goalId: 'goal-strong', title: 'Be strong · Be fit', done: 0, target: 3, pacing: '5 days left · 3 more to plan' },
    ])
  })

  // A goal carries its target whatever its status, and a paused goal can
  // still be in the week through its done or set-aside tasks.
  it('leaves out a goal that is not active', () => {
    const plan = week([task('Lift Mon', MONDAY, { goalId: 'goal-strong', state: 'done' })])
    plan.goals = plan.goals.map((goal) => ({ ...goal, status: 'paused' }))

    expect(weekProgress(plan, WEDNESDAY)).toEqual([])
  })

  it('orders goals by aspiration priority, as the By goal view does', () => {
    const builder: Aspiration = { ...fit, id: 'asp-build', name: 'Be a builder', position: 0 }
    const proto: Goal = { ...strong, id: 'goal-proto', label: 'Prototype', aspirationId: 'asp-build' }
    const target = (goalId: string): TargetFor => ({ ...lifting, goalId })
    const targets = [target('goal-read'), target('goal-strong'), target('goal-proto')]
    const plan: WeekPlan = {
      ...week([], targets),
      goals: withTargets([strong, reading, proto], targets),
      aspirations: [fit, builder],
    }

    expect(weekProgress(plan, WEDNESDAY).map((row) => row.goalId)).toEqual(['goal-proto', 'goal-strong', 'goal-read'])
  })

  it('leaves out goals that are not building goals', () => {
    const plan = { ...week([]), goals: [{ ...strong, type: 'oneOff' as const }] }

    expect(weekProgress(plan, WEDNESDAY)).toEqual([])
  })
})

describe('daySummaries', () => {
  const plan = week([
    task('Lift', MONDAY, { state: 'done' }),
    task('Laundry', MONDAY, { state: 'done' }),
    task('Take out the trash', '2026-11-10', { timeOfDay: { kind: 'by', time: '07:00' }, recurringItemId: 'rec-trash' }),
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
