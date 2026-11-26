// A week read as the API sends it: the current, open week with nothing in it, until the
// fields say otherwise.
import type { Week } from '../api/types.ts'

export function aWeekRead(fields: Pick<Week, 'week'> & Partial<Week>): Week {
  return {
    isCurrent: true,
    nextWeekOpen: false,
    status: 'open',
    firstWeek: null,
    counts: { goalSessions: 0, goals: 0, upkeep: 0, added: 0 },
    tasks: [],
    goals: [],
    days: [],
    occurrences: [],
    checkIns: [],
    deadlines: [],
    quittingGoals: [],
    ...fields,
  }
}
