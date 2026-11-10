import type { Task } from '../api/types.ts'

// Returns a copy of a day or week plan with one task swapped for another.
export function withTaskReplaced<Plan extends { tasks: Task[] }>(plan: Plan, taskId: string, replacement: Task): Plan {
  return { ...plan, tasks: plan.tasks.map((task) => (task.id === taskId ? replacement : task)) }
}
