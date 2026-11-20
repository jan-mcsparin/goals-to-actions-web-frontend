// A day and the bank as screens draw them: from the week read (ADR-010), through the client.
import { getWeek } from '../api/client.ts'
import { mondayOfDay } from '../api/dates.ts'
import { bankOf, dayOf, type Day } from '../domain/today.ts'
import type { Task } from '../api/types.ts'

export async function readDay(date: string): Promise<Day> {
  return dayOf(await getWeek(mondayOfDay(date)), date)
}

// The current week's bank, or the given week's.
export async function readBank(week?: string): Promise<{ week: string; tasks: Task[] }> {
  const read = await getWeek(week)
  return { week: read.week, tasks: bankOf(read) }
}
