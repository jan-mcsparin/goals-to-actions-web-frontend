import { describe, expect, it } from 'vitest'
import type { Aspiration, Bank, DayPlan, Goal, RecurringItem, Task } from '../api/types.ts'
import {
  bankRows,
  dayHeading,
  goalSubline,
  groupByGoal,
  groupForList,
  progress,
  timeLabel,
} from './today.ts'

const DAY = '2026-11-11'

function task(id: string, fields: Partial<Task> = {}): Task {
  return { id, title: id, status: 'planned', weekOf: '2026-11-09', plannedDay: DAY, rolloverCount: 0, ...fields }
}

const fit: Aspiration = { id: 'asp-fit', name: 'Be fit', priority: 2, createdAt: '2026-10-01T09:00:00Z' }
const builder: Aspiration = { id: 'asp-build', name: 'Be a builder', priority: 1, createdAt: '2026-10-01T09:00:00Z' }

function goal(id: string, label: string, aspirationId?: string): Goal {
  return { id, label, measurableLine: '-', type: 'building', status: 'active', startDate: '2026-10-05', aspirationId }
}

const strong = goal('goal-strong', 'Be strong', 'asp-fit')
const prototype = goal('goal-proto', 'Prototype', 'asp-build')
const reading = goal('goal-read', 'Read more')

const trash: RecurringItem = {
  id: 'rec-trash',
  name: 'Take out the trash',
  repeatRule: 'Every Tuesday',
  fixedDay: true,
  active: true,
  nextDue: DAY,
}

function plan(tasks: Task[]): DayPlan {
  return { date: DAY, tasks, goals: [strong, prototype, reading], aspirations: [fit, builder], recurringItems: [trash] }
}

function titles(rows: { task: Task }[]) {
  return rows.map((row) => row.task.title)
}

describe('timeLabel', () => {
  it.each([
    [{ kind: 'by', time: '07:00' }, 'by 7 a.m.'],
    [{ kind: 'at', time: '18:00' }, 'at 6 p.m.'],
    [{ kind: 'at', time: '18:30' }, 'at 6:30 p.m.'],
    [{ kind: 'at', time: '12:00' }, 'at 12 p.m.'],
    [{ kind: 'by', time: '00:00' }, 'by 12 a.m.'],
    [{ kind: 'at', time: '09:05' }, 'at 9:05 a.m.'],
  ] as const)('%o → %s', (timeOfDay, expected) => {
    expect(timeLabel(timeOfDay)).toBe(expected)
  })
})

describe('goalSubline', () => {
  it('joins the goal and its aspiration', () => {
    expect(goalSubline(strong, [fit])).toBe('Be strong · Be fit')
  })

  it('is the goal alone when it has no aspiration', () => {
    expect(goalSubline(reading, [fit])).toBe('Read more')
  })
})

describe('groupForList', () => {
  it('puts recurring and unattached tasks under Keep life running and goal tasks under Move forward', () => {
    const sections = groupForList(
      plan([
        task('Lift', { goalId: 'goal-strong' }),
        task('Trash', { recurringItemId: 'rec-trash' }),
        task('Ballot'),
      ]),
    )

    expect(sections.map((section) => section.title)).toEqual(['Keep life running', 'Move forward'])
    expect(titles(sections[0].rows)).toEqual(['Trash', 'Ballot'])
    expect(titles(sections[1].rows)).toEqual(['Lift'])
  })

  it('orders timed tasks by time, then untimed tasks in plan order', () => {
    const [keep] = groupForList(
      plan([
        task('Untimed A'),
        task('Evening', { timeOfDay: { kind: 'at', time: '18:00' } }),
        task('Untimed B'),
        task('Morning', { timeOfDay: { kind: 'by', time: '07:00' } }),
      ]),
    )

    expect(titles(keep.rows)).toEqual(['Morning', 'Evening', 'Untimed A', 'Untimed B'])
  })

  it('adds time labels and goal sublines', () => {
    const [forward] = groupForList(
      plan([task('Lift', { goalId: 'goal-strong', timeOfDay: { kind: 'at', time: '18:00' } })]),
    )

    expect(forward.rows[0]).toMatchObject({ timeLabel: 'at 6 p.m.', subline: 'Be strong · Be fit' })
  })

  it('leaves out skipped tasks and empty groups', () => {
    const sections = groupForList(plan([task('Ballot'), task('Lift', { goalId: 'goal-strong', status: 'skipped' })]))

    expect(sections.map((section) => section.title)).toEqual(['Keep life running'])
  })
})

describe('groupByGoal', () => {
  it('starts with Keep life running, then one card per goal by aspiration priority', () => {
    const sections = groupByGoal(
      plan([
        task('Read', { goalId: 'goal-read' }),
        task('Lift', { goalId: 'goal-strong' }),
        task('Build', { goalId: 'goal-proto' }),
        task('Trash', { recurringItemId: 'rec-trash' }),
      ]),
    )

    expect(sections.map((section) => section.title)).toEqual([
      'Keep life running',
      'Prototype · Be a builder',
      'Be strong · Be fit',
      'Read more',
    ])
  })

  it('drops the subline inside goal cards, since the title already says it', () => {
    const [card] = groupByGoal(plan([task('Lift', { goalId: 'goal-strong' })]))

    expect(card.rows[0].subline).toBeUndefined()
  })

  it('leaves out goals with no tasks today', () => {
    const sections = groupByGoal(plan([task('Ballot')]))

    expect(sections.map((section) => section.title)).toEqual(['Keep life running'])
  })
})

describe('progress', () => {
  it('counts done over planned and done, ignoring skipped', () => {
    const result = progress(
      plan([task('A', { status: 'done' }), task('B'), task('C'), task('D', { status: 'skipped' })]),
    )

    expect(result).toEqual({ done: 1, total: 3 })
  })
})

describe('dayHeading', () => {
  it('names the weekday of a local day string', () => {
    expect(dayHeading('2026-11-11')).toBe('Today · Wednesday')
    expect(dayHeading('2026-11-15')).toBe('Today · Sunday')
  })
})

describe('bankRows', () => {
  it('lists bank tasks in bank order with time labels and goal sublines', () => {
    const bank: Bank = {
      weekOf: '2026-11-09',
      tasks: [
        task('Deadlift', { status: 'inBank', plannedDay: undefined, goalId: 'goal-strong' }),
        task('Dentist', { status: 'inBank', plannedDay: undefined, timeOfDay: { kind: 'by', time: '17:00' } }),
      ],
      goals: [strong],
      aspirations: [fit],
      recurringItems: [],
    }

    expect(bankRows(bank)).toEqual([
      { task: bank.tasks[0], subline: 'Be strong · Be fit' },
      { task: bank.tasks[1], timeLabel: 'by 5 p.m.' },
    ])
  })
})
