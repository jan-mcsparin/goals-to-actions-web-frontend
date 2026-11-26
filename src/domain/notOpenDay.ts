// A day of a week that hasn't opened (spec 082, product rule 12): the tasks set to it, which can
// be moved or removed, then what's known of it, read-only. Never a guessed plan.
import type { Week } from '../api/types.ts'
import { isOnDay } from './tasks.ts'
import { bankRows, inDayOrder, type TaskRow } from './today.ts'

export type NotOpenDay = {
  rows: TaskRow[]
  // Fixed-day items, check-ins and deadlines, in that order.
  alsoThatDay: string[]
}

export function notOpenDayOf(week: Week, date: string): NotOpenDay {
  return {
    rows: bankRows(inDayOrder(week.tasks.filter((task) => isOnDay(task, date)))),
    alsoThatDay: [
      ...week.occurrences.filter((item) => item.day === date).map((item) => item.title),
      ...week.checkIns
        .filter((checkIn) => checkIn.day === date)
        .map((checkIn) => `Check in: ${checkIn.goalLabel} · Milestone ${checkIn.position} of ${checkIn.of}`),
      ...week.deadlines.filter((deadline) => deadline.day === date).map((deadline) => `Deadline: ${deadline.goalLabel}`),
    ],
  }
}
