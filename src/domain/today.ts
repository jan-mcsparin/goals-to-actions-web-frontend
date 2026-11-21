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

// Today's one quiet line while changes wait after a failed send (ADR-010).
export function waitingLine(count: number): string {
  return count === 1 ? '1 change waiting to send' : `${count} changes waiting to send`
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

// "Be strong · Be fit": the task's goal and that goal's aspiration, as the week names them. A
// recurring item's task under an aspiration with no goal is named by the aspiration alone.
export function goalSubline(task: Pick<Task, 'goalLabel' | 'aspiration'>): string | undefined {
  if (!task.goalLabel) return task.aspiration?.name
  return task.aspiration ? `${task.goalLabel} · ${task.aspiration.name}` : task.goalLabel
}

export function groupForList(plan: Day): Section[] {
  const tasks = inDayOrder(visibleTasks(plan))
  const sections: Section[] = [
    {
      id: 'keep-life-running',
      title: KEEP_LIFE_RUNNING,
      rows: tasks.filter(isMaintenance).map((task) => rowFor(task)),
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
    rows: tasks.filter(isMaintenance).map((task) => rowFor(task)),
  }
  const goalCards = cardsByPriority(tasks).map((cardTask) => ({
    id: cardOf(cardTask)!,
    title: goalSubline(cardTask)!,
    rows: tasks.filter((task) => cardOf(task) === cardOf(cardTask)).map((task) => rowFor(task)),
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

// Under no goal and no aspiration: it keeps life running.
function isMaintenance(task: Task): boolean {
  return cardOf(task) === null
}

// The By goal card a task sits on: its goal's, or for a recurring item's task with no goal,
// its aspiration's own.
function cardOf(task: Task): string | null {
  return task.goalId ?? task.aspiration?.id ?? null
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
    ...(task.fixedDay && { fixed: true as const }),
  }
}

// One task per card, in its aspiration's priority order, an aspiration's goals before its own
// card; goals under none, or a retired one, come last.
function cardsByPriority(tasks: Task[]): Task[] {
  const firsts = tasks.filter((task, index) => !isMaintenance(task) && tasks.findIndex((other) => cardOf(other) === cardOf(task)) === index)
  const priorityOf = (task: Task) => task.aspiration?.position ?? Infinity
  const ownCard = (task: Task) => (task.goalId === null ? 1 : 0)
  return [...firsts].sort((a, b) => priorityOf(a) - priorityOf(b) || ownCard(a) - ownCard(b))
}

function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'a.m.' : 'p.m.'
  const clock = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`
  return `${clock} ${suffix}`
}
