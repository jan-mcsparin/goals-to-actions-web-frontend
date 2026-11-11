import { describe, expect, it } from 'vitest'
import type { Aspiration, Goal, RecurringItem, Task, WeekPlan, WeeklyTarget } from '../api/types.ts'
import { daySummaries, pacingLine, pickableDays, weekProgress, weekRange } from './week.ts'

const MONDAY = '2026-11-09'
const WEDNESDAY = '2026-11-11'

function task(id: string, plannedDay: string | undefined, fields: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    status: plannedDay ? 'planned' : 'inBank',
    weekOf: MONDAY,
    plannedDay,
    rolloverCount: 0,
    ...fields,
  }
}

const fit: Aspiration = { id: 'asp-fit', name: 'Be fit', priority: 1, status: 'active', createdAt: '2026-10-01T09:00:00Z' }
const strong: Goal = {
  id: 'goal-strong',
  label: 'Be strong',
  measurableLine: '-',
  type: 'building',
  status: 'active',
  startDate: '2026-10-05',
  aspirationId: 'asp-fit',
}
const reading: Goal = { ...strong, id: 'goal-read', label: 'Read more', aspirationId: undefined }
const trash: RecurringItem = {
  id: 'rec-trash',
  name: 'Take out the trash',
  repeatRule: 'Every Tuesday',
  fixedDay: true,
  active: true,
  nextDue: '2026-11-10',
}
const lifting: WeeklyTarget = { id: 'wt-1', goalId: 'goal-strong', amount: 3, unit: 'lifting sessions', effectiveFrom: '2026-10-05' }

function week(tasks: Task[], weeklyTargets: WeeklyTarget[] = [lifting]): WeekPlan {
  return { weekOf: MONDAY, tasks, goals: [strong, reading], aspirations: [fit], recurringItems: [trash], weeklyTargets }
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
      task('Lift Mon', MONDAY, { goalId: 'goal-strong', status: 'done' }),
      task('Lift Tue', '2026-11-10', { goalId: 'goal-strong' }),
      task('Lift Wed', WEDNESDAY, { goalId: 'goal-strong' }),
      task('Lift bank', undefined, { goalId: 'goal-strong' }),
      task('Read', WEDNESDAY, { goalId: 'goal-read', status: 'done' }),
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

  it('orders goals by aspiration priority, as the By goal view does', () => {
    const builder: Aspiration = { ...fit, id: 'asp-build', name: 'Be a builder', priority: 0 }
    const proto: Goal = { ...strong, id: 'goal-proto', label: 'Prototype', aspirationId: 'asp-build' }
    const target = (goalId: string): WeeklyTarget => ({ ...lifting, id: `wt-${goalId}`, goalId })
    const plan: WeekPlan = {
      ...week([], [target('goal-read'), target('goal-strong'), target('goal-proto')]),
      goals: [strong, reading, proto],
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
    task('Lift', MONDAY, { status: 'done' }),
    task('Laundry', MONDAY, { status: 'done' }),
    task('Take out the trash', '2026-11-10', { timeOfDay: { kind: 'by', time: '07:00' }, recurringItemId: 'rec-trash' }),
    task('Pay rent', '2026-11-10'),
    task('Lift: bench day', WEDNESDAY, { timeOfDay: { kind: 'at', time: '18:00' } }),
    task('Skipped', WEDNESDAY, { status: 'skipped' }),
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
