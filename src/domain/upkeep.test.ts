import { describe, expect, it } from 'vitest'
import type { RecurringItem, Task } from '../api/types.ts'
import { upkeepView, whereLabel } from './upkeep.ts'
import { aTask } from '../test/tasks.ts'

const WEDNESDAY = '2026-11-11'

function task(id: string, extra: Partial<Task> = {}): Task {
  return aTask(id, extra)
}

function onDay(id: string, plannedDay: string, extra: Partial<Task> = {}): Task {
  return task(id, { plannedDay, ...extra })
}

const rent: RecurringItem = {
  id: 'rec-rent',
  name: 'Pay rent',
  aspirationId: null,
  fromGoalId: null,
  schedule: { kind: 'monthly', dayOfMonth: 1 },
  startsOn: '2026-10-01',
  active: true,
  createdAt: '2026-10-01T09:00:00Z',
}

describe('upkeepView', () => {
  it('lists recurring items by name with how they repeat', () => {
    const view = upkeepView({ recurringItems: [rent], tasks: [] }, WEDNESDAY)

    expect(view.recurring).toEqual([{ id: 'rec-rent', name: 'Pay rent', repeat: 'Monthly on the 1st' }])
  })

  it('says where each task sits: a day, the bank, or a later week', () => {
    const tasks = [
      onDay('Groceries', '2026-11-12'),
      task('Call the dentist'),
      task('Renew the insurance', { week: '2026-11-23' }),
    ]

    const { todo } = upkeepView({ recurringItems: [], tasks }, WEDNESDAY)

    expect(todo).toEqual([
      { taskId: 'Groceries', title: 'Groceries', where: 'Thursday' },
      { taskId: 'Call the dentist', title: 'Call the dentist', where: 'In the bank' },
      { taskId: 'Renew the insurance', title: 'Renew the insurance', where: 'Week of Nov 23' },
    ])
  })

  it('adds the due date when a task has one', () => {
    const tasks = [onDay('Fill out my ballot', WEDNESDAY, { dueDate: '2026-11-13' })]

    const { todo } = upkeepView({ recurringItems: [], tasks }, WEDNESDAY)

    expect(todo[0]).toMatchObject({ where: 'Today', due: 'due Nov 13' })
  })

  it('orders tasks by day, then the bank, then later weeks, then those with no week yet', () => {
    const tasks = [
      task('upcoming', { week: null, dueDate: '2026-12-15' }),
      task('later', { week: '2026-11-16' }),
      task('bank'),
      onDay('saturday', '2026-11-14'),
      onDay('today', WEDNESDAY),
    ]

    const { todo } = upkeepView({ recurringItems: [], tasks }, WEDNESDAY)

    expect(todo.map((row) => row.taskId)).toEqual(['today', 'saturday', 'bank', 'later', 'upcoming'])
  })

  it('is empty on both sides when there is nothing', () => {
    expect(upkeepView({ recurringItems: [], tasks: [] }, WEDNESDAY)).toEqual({ recurring: [], todo: [] })
  })
})

describe('whereLabel', () => {
  it('names a later week even when the task already has a day in it', () => {
    expect(whereLabel(onDay('later', '2026-11-25', { week: '2026-11-23' }), WEDNESDAY)).toBe('Week of Nov 23')
  })

  it('names an earlier day of this week by its weekday', () => {
    expect(whereLabel(onDay('monday', '2026-11-09'), WEDNESDAY)).toBe('Monday')
  })

  // From the upcoming list: due beyond the open weeks, it joins its week's bank when that opens.
  it('says Later for a task with no week yet', () => {
    expect(whereLabel(task('upcoming', { week: null, dueDate: '2026-12-15' }), WEDNESDAY)).toBe('Later')
  })

  it('works out this week from any day in it', () => {
    expect(whereLabel(task('bank'), '2026-11-15')).toBe('In the bank')
    expect(whereLabel(task('next', { week: '2026-11-16' }), '2026-11-15')).toBe('Week of Nov 16')
  })
})
