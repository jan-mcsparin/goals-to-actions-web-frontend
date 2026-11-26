// The mock's fullness and dated items for a week read, counted the way the API counts them
// (product rule 11): tasks by origin, never check-ins or deadlines; and, for a week that hasn't
// opened, what's known of it. Only client.ts imports this.
import { addDays, fromLocalDay, toLocalDay } from './dates.ts'
import type { MockData } from './mockData.ts'
import type { CheckInDate, DayCounts, GoalDeadline, Occurrence, Schedule, Task, WeekCounts } from './types.ts'

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

export function weekDays(week: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => toLocalDay(addDays(fromLocalDay(week), offset)))
}

// What opening the week would bring: each active building goal's sessions, each item that's
// on (a fixed one if it's due that week), and the tasks pinned to it or due in it.
export function expectedCounts(
  store: MockData,
  week: string,
  pinned: Task[],
  sessionsOf: (goalId: string) => number,
): WeekCounts {
  const sessions = store.goals.flatMap((goal) =>
    goal.status === 'active' && goal.type === 'building' ? [sessionsOf(goal.id)] : [],
  )
  const items = store.recurringItems.filter((item) => item.active && item.startsOn <= week)
  const upkeep = items.reduce((sum, item) => {
    if (item.schedule.kind !== 'flexible') return sum + (fixedDayIn(item.schedule, week) ? 1 : 0)
    return sum + (item.schedule.period === 'week' ? item.schedule.times : 0)
  }, 0)
  const days = weekDays(week)
  const due = store.tasks.filter(
    (task) => task.origin === 'byHand' && task.week === null && task.dueDate !== null && days.includes(task.dueDate),
  )
  return {
    goalSessions: sessions.reduce((sum, count) => sum + count, 0),
    goals: sessions.filter((count) => count > 0).length,
    upkeep,
    added: pinned.length + due.length,
  }
}

export function occurrencesIn(store: MockData, week: string): Occurrence[] {
  return store.recurringItems.flatMap((item) => {
    const day = item.active ? fixedDayIn(item.schedule, week) : null
    return day && item.startsOn <= day ? [{ recurringItemId: item.id, title: item.name, day }] : []
  })
}

// Dated milestones not hit yet, under active goals.
export function checkInsIn(store: MockData, week: string): CheckInDate[] {
  const days = weekDays(week)
  return store.goals.flatMap((goal) => {
    if (goal.status !== 'active') return []
    const milestones = store.milestones.filter((milestone) => milestone.goalId === goal.id)
    return milestones.flatMap((milestone, index) =>
      milestone.status !== 'hit' && milestone.targetDate && days.includes(milestone.targetDate)
        ? [{ goalId: goal.id, goalLabel: goal.label, milestoneId: milestone.id, position: index + 1, of: milestones.length + 1, day: milestone.targetDate }]
        : [],
    )
  })
}

export function deadlinesIn(store: MockData, week: string): GoalDeadline[] {
  const days = weekDays(week)
  return store.goals.flatMap((goal) =>
    goal.status === 'active' && goal.deadline && days.includes(goal.deadline)
      ? [{ goalId: goal.id, goalLabel: goal.label, day: goal.deadline }]
      : [],
  )
}
