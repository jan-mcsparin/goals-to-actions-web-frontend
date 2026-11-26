import { describe, expect, it } from 'vitest'
import { aTask } from '../test/tasks.ts'
import { aWeekRead } from '../test/weeks.ts'
import { notOpenDayOf } from './notOpenDay.ts'

const WEEK = '2026-12-07'
const TUESDAY = '2026-12-08'

describe('notOpenDayOf', () => {
  it("lists the day's set tasks, in day order, then what's known of it", () => {
    const week = aWeekRead({
      week: WEEK,
      status: 'notOpen',
      tasks: [
        aTask('dentist', { title: 'Dentist cleaning', week: WEEK, plannedDay: TUESDAY, placedByHand: true, timeOfDay: { kind: 'at', time: '15:00' } }),
        aTask('deposit', { title: 'Pay the ski trip deposit', week: WEEK, plannedDay: TUESDAY, placedByHand: true }),
        aTask('other-day', { week: WEEK, plannedDay: '2026-12-09', placedByHand: true }),
      ],
      occurrences: [{ day: TUESDAY, recurringItemId: 'rec-trash', title: 'Take out the trash' }],
      checkIns: [{ day: TUESDAY, goalId: 'g1', goalLabel: 'Lift', milestoneId: 'm3', position: 3, of: 4 }],
      deadlines: [
        { day: TUESDAY, goalId: 'g1', goalLabel: 'Lift' },
        { day: '2026-12-09', goalId: 'g2', goalLabel: 'Run' },
      ],
    })

    const day = notOpenDayOf(week, TUESDAY)

    expect(day.rows.map((row) => row.task.id)).toEqual(['dentist', 'deposit'])
    expect(day.rows[0].timeLabel).toBe('at 3 p.m.')
    expect(day.alsoThatDay).toEqual(['Take out the trash', 'Check in: Lift · Milestone 3 of 4', 'Deadline: Lift'])
  })

  it('is empty on a day with nothing set', () => {
    expect(notOpenDayOf(aWeekRead({ week: WEEK, status: 'notOpen' }), TUESDAY)).toEqual({ rows: [], alsoThatDay: [] })
  })
})
