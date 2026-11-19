// A task as the API sends it: open, in the week of 9 Nov 2026's bank, until the fields say
// otherwise. Its origin follows its goal or recurring item.
import type { Task } from '../api/types.ts'
import { isDone, isInBank } from '../domain/tasks.ts'

export function aTask(id: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    origin: fields.goalId ? 'weeklyTarget' : fields.recurringItemId ? 'recurringItem' : 'byHand',
    state: 'open',
    goalId: null,
    goalLabel: null,
    recurringItemId: null,
    dueDate: null,
    timeOfDay: null,
    valueLogged: null,
    completedAt: null,
    completedOn: null,
    week: '2026-11-09',
    plannedDay: null,
    placedByHand: false,
    carriedOver: 0,
    atClose: null,
    stillMatters: false,
    ...fields,
  }
}

// Where a task is, in a word: set aside (the mock's own flag), done, in the bank, or planned.
export function whereIs(task: Task & { setAside?: boolean }): 'setAside' | 'done' | 'inBank' | 'planned' {
  if (task.setAside) return 'setAside'
  if (isDone(task)) return 'done'
  return isInBank(task) ? 'inBank' : 'planned'
}
