// The current week and next week as the phone last stored them: the phone's own
// week, or the one after once that has been wrapped up early; next week once open.
import { mondayOfDay, toLocalDay, weekAfter } from '../api/dates.ts'
import type { Week } from '../api/types.ts'
import { planStore } from './planStore.ts'

export async function storedCurrentAndNext(now = new Date()): Promise<Week[]> {
  const phonesWeek = mondayOfDay(toLocalDay(now))
  const own = await planStore().weeks.get(phonesWeek)
  const current = own && !own.isCurrent ? await planStore().weeks.get(weekAfter(phonesWeek)) : own
  if (!current) return []
  const next = current.nextWeekOpen ? await planStore().weeks.get(weekAfter(current.week)) : undefined
  return next ? [current, next] : [current]
}
