// The plan functions of api/client.ts, on the real API: the week read and what the person does
// to its tasks. Same signatures as the mock ones, so hooks and screens don't know which they
// got. A plan edit names the week it was made in, and is refused (409) once the task has left it.
import { mondayOfDay, toLocalDay, weekAfter } from './dates.ts'
import { newDeviceId } from './ids.ts'
import { request } from './request.ts'
import type { CheckOff, NewTask, StillMattersAnswer, Task, Week } from './types.ts'

// With no week, the current one: the phone's own week, or the one after once that has been
// wrapped up early (the API then reads the phone's week as not current).
export async function getWeek(week?: string): Promise<Week> {
  if (week !== undefined) return request('GET', `/weeks/${week}`)
  const phonesWeek = mondayOfDay(toLocalDay(new Date()))
  const read = await request<Week>('GET', `/weeks/${phonesWeek}`)
  return read.isCurrent ? read : request('GET', `/weeks/${weekAfter(phonesWeek)}`)
}

// At an id made here, so sending it again makes no second task.
export async function addTask(task: NewTask): Promise<Task> {
  return request('PUT', `/tasks/${newDeviceId()}`, task)
}

export async function checkOffTask(taskId: string, checkOff: CheckOff): Promise<Task> {
  return request('POST', `/tasks/${taskId}/check-off`, checkOff)
}

export async function uncheckTask(taskId: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/uncheck`)
}

export async function moveTaskToBank(taskId: string, week: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/bank`, { week })
}

export async function placeTask(taskId: string, week: string, day: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/place`, { week, day })
}

export async function swapTasks(
  taskId: string,
  swap: { week: string; bankTaskId: string; day: string },
): Promise<{ toBank: Task; placed: Task }> {
  return request('POST', `/tasks/${taskId}/swap`, swap)
}

export async function answerStillMatters(taskId: string, answer: StillMattersAnswer): Promise<Task> {
  return request('POST', `/tasks/${taskId}/still-matters`, answer)
}

// Returns the new current week.
export async function wrapUpWeek(week: string): Promise<Week> {
  return request('POST', `/weeks/${week}/wrap-up`)
}
