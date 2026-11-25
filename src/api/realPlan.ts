// The plan functions of api/client.ts, on the real API: the week read and what the person does
// to its tasks. Same signatures as the mock ones, so hooks and screens don't know which they
// got. A plan edit names the week it was made in, and is refused (409) once the task has left it.
import { mondayOfDay, toLocalDay, weekAfter } from './dates.ts'
import { newDeviceId } from './ids.ts'
import { request } from './request.ts'
import type { components } from './openapi.ts'
import type {
  CheckOff,
  NewRecurringItem,
  NewTask,
  RecurringItem,
  RecurringItemEdit,
  StillMattersAnswer,
  Task,
  Upkeep,
  Week,
} from './types.ts'

type RecurringItemList = components['schemas']['RecurringItemList']
type Upcoming = components['schemas']['Upcoming']

// The six writes the queue sends (api/queue.ts): they don't wait for it, being it.
const QUEUED = { queued: true }

// With no week, the current one: the phone's own week, or the one after once that has been
// wrapped up early (the API then reads the phone's week as not current).
export async function getWeek(week?: string): Promise<Week> {
  if (week !== undefined) return request('GET', `/weeks/${week}`)
  const phonesWeek = mondayOfDay(toLocalDay(new Date()))
  const read = await request<Week>('GET', `/weeks/${phonesWeek}`)
  return read.isCurrent ? read : request('GET', `/weeks/${weekAfter(phonesWeek)}`)
}

// At an id made here, so sending it again makes no second task. A queued add brings its own.
export async function addTask(task: NewTask, taskId = newDeviceId()): Promise<Task> {
  return request('PUT', `/tasks/${taskId}`, task, QUEUED)
}

export async function checkOffTask(taskId: string, checkOff: CheckOff): Promise<Task> {
  return request('POST', `/tasks/${taskId}/check-off`, checkOff, QUEUED)
}

export async function uncheckTask(taskId: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/uncheck`, undefined, QUEUED)
}

export async function moveTaskToBank(taskId: string, week: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/bank`, { week }, QUEUED)
}

export async function placeTask(taskId: string, week: string, day: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/place`, { week, day }, QUEUED)
}

export async function swapTasks(
  taskId: string,
  swap: { week: string; bankTaskId: string; day: string },
): Promise<{ toBank: Task; placed: Task }> {
  return request('POST', `/tasks/${taskId}/swap`, swap, QUEUED)
}

export async function answerStillMatters(taskId: string, answer: StillMattersAnswer): Promise<Task> {
  return request('POST', `/tasks/${taskId}/still-matters`, answer)
}

// Returns the new current week.
export async function wrapUpWeek(week: string): Promise<Week> {
  return request('POST', `/weeks/${week}/wrap-up`)
}

// Every item, on and off, oldest first. One with no aspiration is in Keep life running.
export async function listRecurringItems(): Promise<RecurringItem[]> {
  return (await request<RecurringItemList>('GET', '/recurring-items')).recurringItems
}

// At an id made here, so sending it again makes no second item.
export async function createRecurringItem(item: NewRecurringItem): Promise<RecurringItem> {
  return request('PUT', `/recurring-items/${newDeviceId()}`, item)
}

// Sent whole. The API moves this week's open tasks to follow it (API #49).
export async function updateRecurringItem(itemId: string, edit: RecurringItemEdit): Promise<RecurringItem> {
  return request('PATCH', `/recurring-items/${itemId}`, edit)
}

// Its open tasks leave the days and the bank of every open week; turned on, they come back to the bank.
export async function turnOffRecurringItem(itemId: string): Promise<RecurringItem> {
  return request('POST', `/recurring-items/${itemId}/turn-off`)
}

export async function turnOnRecurringItem(itemId: string): Promise<RecurringItem> {
  return request('POST', `/recurring-items/${itemId}/turn-on`)
}

// Open tasks with a due date and no week yet: they join a week's bank when it opens.
export async function getUpcoming(): Promise<Task[]> {
  return (await request<Upcoming>('GET', '/tasks/upcoming')).tasks
}

// Keep life running: the items under no aspiration, on and off, and the open tasks with no
// goal and no item, from the open weeks and the upcoming list.
export async function getUpkeep(): Promise<Upkeep> {
  const [items, current, upcoming] = await Promise.all([listRecurringItems(), getWeek(), getUpcoming()])
  const next = current.nextWeekOpen ? await getWeek(weekAfter(current.week)) : undefined
  const tasks = [...current.tasks, ...(next?.tasks ?? []), ...upcoming]
  return {
    recurringItems: items.filter((item) => item.aspirationId === null),
    tasks: tasks.filter((task) => task.state === 'open' && task.goalId === null && task.recurringItemId === null),
  }
}
