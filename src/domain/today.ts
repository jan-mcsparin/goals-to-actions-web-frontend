// What the Today screen shows, worked out from a TodayPlan. Components render
// these sections as they come; all grouping, ordering and wording lives here.
import type { Aspiration, Goal, Task, TimeOfDay, TodayPlan } from '../api/types.ts'

export type TaskRow = {
  task: Task
  timeLabel?: string
  subline?: string
}

export type Section = {
  id: string
  title: string
  rows: TaskRow[]
}

const KEEP_LIFE_RUNNING = 'Keep life running'
const MOVE_FORWARD = 'Move forward'

export function dayHeading(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const weekday = new Date(year, month - 1, date).toLocaleDateString('en-US', { weekday: 'long' })
  return `Today · ${weekday}`
}

export function progress(plan: TodayPlan): { done: number; total: number } {
  const onToday = visibleTasks(plan)
  return { done: onToday.filter((task) => task.status === 'done').length, total: onToday.length }
}

export function timeLabel({ kind, time }: TimeOfDay): string {
  return `${kind} ${formatClock(time)}`
}

export function goalSubline(goal: Goal, aspirations: Aspiration[]): string {
  const aspiration = aspirations.find((candidate) => candidate.id === goal.aspirationId)
  return aspiration ? `${goal.label} · ${aspiration.name}` : goal.label
}

export function groupForList(plan: TodayPlan): Section[] {
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
      rows: tasks
        .filter((task) => !isMaintenance(task))
        .map((task) => rowFor(task, sublineFor(task, plan))),
    },
  ]
  return sections.filter((section) => section.rows.length > 0)
}

export function groupByGoal(plan: TodayPlan): Section[] {
  const tasks = inDayOrder(visibleTasks(plan))
  const maintenance: Section = {
    id: 'keep-life-running',
    title: KEEP_LIFE_RUNNING,
    rows: tasks.filter(isMaintenance).map((task) => rowFor(task)),
  }
  const goalCards = goalsByPriority(plan).map((goal) => ({
    id: goal.id,
    title: goalSubline(goal, plan.aspirations),
    rows: tasks.filter((task) => task.goalId === goal.id).map((task) => rowFor(task)),
  }))
  return [maintenance, ...goalCards].filter((section) => section.rows.length > 0)
}

// Skipped tasks have gone back to the bank, so they're no longer part of today.
function visibleTasks(plan: TodayPlan): Task[] {
  return plan.tasks.filter((task) => task.status === 'planned' || task.status === 'done')
}

function isMaintenance(task: Task): boolean {
  return task.goalId === undefined
}

// Timed tasks anchor the day in time order; untimed ones follow in plan order.
function inDayOrder(tasks: Task[]): Task[] {
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

function sublineFor(task: Task, plan: TodayPlan): string | undefined {
  const goal = plan.goals.find((candidate) => candidate.id === task.goalId)
  return goal && goalSubline(goal, plan.aspirations)
}

function goalsByPriority(plan: TodayPlan): Goal[] {
  const priorityOf = (goal: Goal) =>
    plan.aspirations.find((aspiration) => aspiration.id === goal.aspirationId)?.priority ?? Infinity
  return [...plan.goals].sort((a, b) => priorityOf(a) - priorityOf(b))
}

function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'a.m.' : 'p.m.'
  const clock = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, '0')}`
  return `${clock} ${suffix}`
}
