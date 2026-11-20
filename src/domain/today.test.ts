import { describe, expect, it } from 'vitest'
import type { Task, Week } from '../api/types.ts'
import {
  bankOf,
  bankRows,
  dayHeading,
  dayOf,
  goalSubline,
  groupByGoal,
  groupForList,
  progress,
  timeLabel,
  type Day,
} from './today.ts'
import { aTask } from '../test/tasks.ts'

const DAY = '2026-11-11'

const fit = { id: 'asp-fit', name: 'Be fit', position: 2 }
const builder = { id: 'asp-build', name: 'Be a builder', position: 1 }

// What the week read says about each task's goal: its label and its aspiration.
const GOALS: Record<string, Pick<Task, 'goalLabel' | 'aspiration'>> = {
  'goal-strong': { goalLabel: 'Be strong', aspiration: fit },
  'goal-proto': { goalLabel: 'Prototype', aspiration: builder },
  'goal-read': { goalLabel: 'Read more', aspiration: null },
}

function task(id: string, fields: Partial<Task> = {}): Task {
  return aTask(id, { plannedDay: DAY, ...(fields.goalId ? GOALS[fields.goalId] : {}), ...fields })
}

// DayPlan became a Day drawn from the week (dayOf); a task's goal is named on the task.
function plan(tasks: Task[]): Day {
  return { date: DAY, tasks, stillMatters: [] }
}

function weekOf(tasks: Task[]): Week {
  return { week: '2026-11-09', isCurrent: true, nextWeekOpen: false, tasks, goals: [], days: [], quittingGoals: [] }
}

function titles(rows: { task: Task }[]) {
  return rows.map((row) => row.task.title)
}

describe('dayOf', () => {
  it("gives the day's tasks, done ones included, and the week's Still matter? tasks", () => {
    const week = weekOf([
      task('Lift', { state: 'done' }),
      task('Thursday', { plannedDay: '2026-11-12' }),
      task('Bank', { plannedDay: null }),
      task('Asking', { plannedDay: '2026-11-13', stillMatters: true }),
    ])

    const day = dayOf(week, DAY)

    expect(day.date).toBe(DAY)
    expect(titles(day.tasks.map((task) => ({ task })))).toEqual(['Lift'])
    expect(day.stillMatters.map((task) => task.id)).toEqual(['Asking'])
  })
})

describe('bankOf', () => {
  it("gives the week's open tasks not on a day, in the week's order", () => {
    const week = weekOf([task('Lift'), task('Dentist', { plannedDay: null }), task('Done', { plannedDay: null, state: 'done' }), task('Garage', { plannedDay: null })])

    expect(bankOf(week).map((task) => task.id)).toEqual(['Dentist', 'Garage'])
  })
})

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
    expect(goalSubline(task('Lift', { goalId: 'goal-strong' }))).toBe('Be strong · Be fit')
  })

  it('is the goal alone when it has no aspiration', () => {
    expect(goalSubline(task('Read', { goalId: 'goal-read' }))).toBe('Read more')
  })

  it('is nothing for a task with no goal', () => {
    expect(goalSubline(task('Ballot'))).toBeUndefined()
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

  it('leaves out tasks that went back to the bank, and empty groups', () => {
    const sections = groupForList(plan([task('Ballot'), task('Lift', { goalId: 'goal-strong', plannedDay: null })]))

    expect(sections.map((section) => section.title)).toEqual(['Keep life running'])
  })
})

describe('fixed-day tasks', () => {
  it('marks rows the week says are fixed to their day, in both views', () => {
    const tasks = [
      task('Trash', { recurringItemId: 'rec-trash', fixedDay: true }),
      task('Laundry', { recurringItemId: 'rec-laundry' }),
      task('Ballot'),
    ]
    const dayPlan = plan(tasks)

    for (const sections of [groupForList(dayPlan), groupByGoal(dayPlan)]) {
      const rows = sections[0].rows
      expect(rows.map((row) => [row.task.title, row.fixed ?? false])).toEqual([
        ['Trash', true],
        ['Laundry', false],
        ['Ballot', false],
      ])
    }
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

  it('puts a goal under a retired aspiration last, with goals under none', () => {
    const retired = { id: 'asp-old', name: 'Old', position: null }
    const sections = groupByGoal(
      plan([task('Old', { goalId: 'goal-old', goalLabel: 'Old goal', aspiration: retired }), task('Lift', { goalId: 'goal-strong' })]),
    )

    expect(sections.map((section) => section.title)).toEqual(['Be strong · Be fit', 'Old goal · Old'])
  })

  it('drops the subline inside goal cards, since the title already says it', () => {
    const [card] = groupByGoal(plan([task('Lift', { goalId: 'goal-strong' })]))

    expect(card.rows[0].subline).toBeUndefined()
  })

  it('leaves out goals with no tasks today', () => {
    const sections = groupByGoal(plan([task('Ballot')]))

    expect(sections.map((section) => section.title)).toEqual(['Keep life running'])
  })

  it('gives each card its own count for the day, ignoring tasks back in the bank', () => {
    const sections = groupByGoal(
      plan([
        task('Lift', { goalId: 'goal-strong', state: 'done' }),
        task('Run', { goalId: 'goal-strong' }),
        task('Stretch', { goalId: 'goal-strong', plannedDay: null }),
        task('Trash', { recurringItemId: 'rec-trash', state: 'done' }),
      ]),
    )

    expect(sections.map((section) => [section.title, section.progress])).toEqual([
      ['Keep life running', { done: 1, total: 1 }],
      ['Be strong · Be fit', { done: 1, total: 2 }],
    ])
  })

  it('leaves the count off List sections', () => {
    const sections = groupForList(plan([task('Lift', { goalId: 'goal-strong' })]))

    expect(sections[0].progress).toBeUndefined()
  })
})

describe('progress', () => {
  it('counts done over planned and done, ignoring tasks back in the bank', () => {
    const result = progress(
      plan([task('A', { state: 'done' }), task('B'), task('C'), task('D', { plannedDay: null })]),
    )

    expect(result).toEqual({ done: 1, total: 3 })
  })
})

describe('dayHeading', () => {
  it('says Today and the weekday for today', () => {
    expect(dayHeading('2026-11-11', '2026-11-11')).toBe('Today · Wednesday')
    expect(dayHeading('2026-11-15', '2026-11-15')).toBe('Today · Sunday')
  })

  it('gives the weekday and date for any other day', () => {
    expect(dayHeading('2026-11-12', '2026-11-11')).toBe('Thursday · Nov 12')
    expect(dayHeading('2026-11-10', '2026-11-11')).toBe('Tuesday · Nov 10')
    expect(dayHeading('2026-12-01', '2026-11-11')).toBe('Tuesday · Dec 1')
  })
})

describe('bankRows', () => {
  it('lists bank tasks in bank order with time labels and goal sublines', () => {
    const tasks = [
      task('Deadlift', { plannedDay: null, goalId: 'goal-strong' }),
      task('Dentist', { plannedDay: null, timeOfDay: { kind: 'by', time: '17:00' } }),
    ]

    expect(bankRows(tasks)).toEqual([
      { task: tasks[0], subline: 'Be strong · Be fit' },
      { task: tasks[1], timeLabel: 'by 5 p.m.' },
    ])
  })
})
