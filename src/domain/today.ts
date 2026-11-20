// What the Today screen shows, drawn from the week read (ADR-010). Components render these
// sections as they come; all grouping, ordering and wording lives here.
import { fromLocalDay } from '../api/dates.ts'
import type { Task, TimeOfDay, Week } from '../api/types.ts'
import { isDone, isInBank, isOnDay } from './tasks'

export type TaskRow = {
  task: Task
  timeLabel?: string
  subline?: string
  // From a fixed-day recurring item (trash on Tuesday): it stays on its day.
  fixed?: true
}

export type Progress = { done: number; total: number }

export type Section = {
  id: string
  title: string
  rows: TaskRow[]
  // By goal only: how much of this card is done on the day.
  progress?: Progress
}

// One day of a week: its tasks, and the tasks asking "Still matter?" wherever they sit that
// week (Today shows them).
export type Day = {
  date: string
  tasks: Task[]
  stillMatters: Task[]
}

const KEEP_LIFE_RUNNING = 'Keep life running'
const MOVE_FORWARD = 'Move forward'

export function dayOf(week: Week, date: string): Day {
  return {
    date,
    tasks: week.tasks.filter((task) => task.plannedDay === date),
    stillMatters: week.tasks.filter((task) => task.stillMatters),
  }
}

// The week's tasks not yet on a day, in the order the week sends them.
export function bankOf(week: Week): Task[] {
  return week.tasks.filter(isInBank)
}

export function dayHeading(day: string, today: string): string {
  const calendarDay = fromLocalDay(day)
  const weekday = calendarDay.toLocaleDateString('en-US', { weekday: 'long' })
  if (day === today) return `Today · ${weekday}`
  return `${weekday} · ${calendarDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export function progress(plan: Day): Progress {
  return countDone(visibleTasks(plan))
}

function countDone(tasks: Task[]): Progress {
  return { done: tasks.filter(isDone).length, total: tasks.length }
}

export function timeLabel({ kind, time }: TimeOfDay): string {
  return `${kind} ${formatClock(time)}`
}

// "Be strong · Be fit": the task's goal and that goal's aspiration, as the week names them.
export function goalSubline(task: Pick<Task, 'goalLabel' | 'aspiration'>): string | undefined {
  if (!task.goalLabel) return undefined
  return task.aspiration ? `${task.goalLabel} · ${task.aspiration.name}` : task.goalLabel
}

export function groupForList(plan: Day): Section[] {
  const tasks = inDayOrder(visibleTasks(plan))
  const sections: Section[] = [
    {
      id: 'keep-life-running',
      title: KEEP_LIFE_RUNNING,
      rows: tasks.filter(isMaintenance).map(maintenanceRow),
    },
    {
      id: 'move-forward',
      title: MOVE_FORWARD,
      rows: tasks.filter((task) => !isMaintenance(task)).map((task) => rowFor(task, goalSubline(task))),
    },
  ]
  return sections.filter((section) => section.rows.length > 0)
}

export function groupByGoal(plan: Day): Section[] {
  const tasks = inDayOrder(visibleTasks(plan))
  const maintenance: Section = {
    id: 'keep-life-running',
    title: KEEP_LIFE_RUNNING,
    rows: tasks.filter(isMaintenance).map(maintenanceRow),
  }
  const goalCards = goalsByPriority(tasks).map((goalTask) => ({
    id: goalTask.goalId!,
    title: goalSubline(goalTask)!,
    rows: tasks.filter((task) => task.goalId === goalTask.goalId).map((task) => rowFor(task)),
  }))
  return [maintenance, ...goalCards]
    .filter((section) => section.rows.length > 0)
    .map((section) => ({ ...section, progress: countDone(section.rows.map((row) => row.task)) }))
}

export function bankRows(tasks: Task[]): TaskRow[] {
  return tasks.map((task) => rowFor(task, goalSubline(task)))
}

// A task that went back to the bank is no longer part of today.
function visibleTasks(plan: Day): Task[] {
  return plan.tasks.filter((task) => isOnDay(task))
}

function isMaintenance(task: Task): boolean {
  return task.goalId === null
}

// Timed tasks anchor the day in time order; untimed ones follow in plan order.
export function inDayOrder(tasks: Task[]): Task[] {
  const timed = tasks
    .filter((task) => task.timeOfDay)
    .sort((a, b) => a.timeOfDay!.time.localeCompare(b.timeOfDay!.time))
  const untimed = tasks.filter((task) => !task.timeOfDay)
  return [...timed, ...untimed]
}

function rowFor(task: Task, subline?: string): TaskRow {
  return {
    task,
    ...(task.timeOfDay && { timeLabel: timeLabel(task.timeOfDay) }),
    ...(subline && { subline }),
  }
}

function maintenanceRow(task: Task): TaskRow {
  return task.fixedDay ? { ...rowFor(task), fixed: true } : rowFor(task)
}

// One task per goal, in its aspiration's priority order; goals under none, or a retired one,
// come last.
function goalsByPriority(tasks: Task[]): Task[] {
  const firsts = tasks.filter((task, index) => task.goalId !== null && tasks.findIndex((other) => other.goalId === task.goalId) === index)
  const priorityOf = (task: Task) => task.aspiration?.position ?? Infinity
  return [...firsts].sort((a, b) => priorityOf(a) - priorityOf(b))
}

function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'a.m.' : 'p.m.'
  const clock = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`
  return `${clock} ${suffix}`
}
