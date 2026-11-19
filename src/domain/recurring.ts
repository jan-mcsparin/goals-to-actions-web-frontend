// How a recurring item's schedule reads, in one place: "Every Tuesday",
// "Monthly on the 1st", "3 times a week". The API sends only the fields.
import type { Schedule } from '../api/types.ts'

export type Weekday = Extract<Schedule, { kind: 'weekly' }>['weekday']

export function repeatText(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'weekly':
      return `Every ${weekdayName(schedule.weekday)}`
    case 'monthly':
      return `Monthly on the ${ordinal(schedule.dayOfMonth)}`
    case 'flexible':
      if (schedule.period === 'twoWeeks') return 'Every two weeks'
      if (schedule.period === 'month') return 'Once a month'
      return schedule.times === 1 ? 'Once a week' : `${schedule.times} times a week`
  }
}

// A fixed-day item happens on its day; a flexible one fits wherever there's room.
export function isFixedDay(schedule: Schedule): boolean {
  return schedule.kind !== 'flexible'
}

export function weekdayName(weekday: Weekday): string {
  return weekday[0].toUpperCase() + weekday.slice(1)
}

export function ordinal(day: number): string {
  const teens = day % 100 >= 11 && day % 100 <= 13
  const suffix = teens ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th')
  return `${day}${suffix}`
}
