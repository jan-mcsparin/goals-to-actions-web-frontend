// The mock's fullness and dated items for a week read, counted the way the API counts them
// (product rule 11): tasks by origin, never check-ins or deadlines. Only client.ts imports this.
import { addDays, fromLocalDay, toLocalDay } from './dates.ts'
import type { DayCounts, Schedule, Task, WeekCounts } from './types.ts'

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function countsOf(tasks: Pick<Task, 'origin' | 'goalId'>[]): WeekCounts {
  const sessions = tasks.filter((task) => task.origin === 'weeklyTarget')
  return {
    goalSessions: sessions.length,
    goals: new Set(sessions.map((task) => task.goalId)).size,
    upkeep: tasks.filter((task) => task.origin === 'recurringItem').length,
    added: tasks.filter((task) => task.origin === 'byHand').length,
  }
}

export function dayCountsOf(tasks: Pick<Task, 'origin' | 'goalId' | 'plannedDay'>[], day: string): DayCounts {
  const { goalSessions, upkeep, added } = countsOf(tasks.filter((task) => task.plannedDay === day))
  return { goalSessions, upkeep, added }
}

// A weekly or monthly item's day in the week, if the week holds it.
export function fixedDayIn(schedule: Schedule, week: string): string | null {
  const monday = fromLocalDay(week)
  if (schedule.kind === 'weekly') return toLocalDay(addDays(monday, WEEKDAYS.indexOf(schedule.weekday)))
  if (schedule.kind === 'monthly') {
    const days = Array.from({ length: 7 }, (_, offset) => addDays(monday, offset))
    const due = days.find((day) => day.getDate() === schedule.dayOfMonth)
    return due ? toLocalDay(due) : null
  }
  return null
}
