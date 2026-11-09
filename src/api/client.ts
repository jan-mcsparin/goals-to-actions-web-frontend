// The functions screens and hooks call. They read the in-memory mock store for
// now; later they call the real API and keep the same signatures.
import { toLocalDay } from './dates.ts'
import { store } from './mockStore.ts'
import type { Task, TodayPlan } from './types.ts'

export async function getToday(): Promise<TodayPlan> {
  const date = toLocalDay(new Date())
  const tasks = store.tasks.filter((task) => task.plannedDay === date)
  return structuredClone({ date, tasks, ...recordsReferencedBy(tasks) })
}

function recordsReferencedBy(tasks: Task[]) {
  const goals = store.goals.filter((goal) => tasks.some((task) => task.goalId === goal.id))
  const recurringItems = store.recurringItems.filter((item) =>
    tasks.some((task) => task.recurringItemId === item.id),
  )
  const aspirationIds = new Set(
    [...goals, ...recurringItems].flatMap((record) => record.aspirationId ?? []),
  )
  const aspirations = store.aspirations.filter((aspiration) => aspirationIds.has(aspiration.id))
  return { goals, recurringItems, aspirations }
}
