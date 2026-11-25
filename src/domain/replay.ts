// What the screen shows of a week: the week as the server sent it, with the
// changes not yet confirmed replayed on top (ADR-010). One rule per kind of
// change; a rule does nothing when its task isn't in the week. The stored week
// is never changed: each rule returns a new one.
import { mondayOfDay, weekAfter } from '../api/dates.ts'
import type { CheckOff, NewTask, QuitDay, Task, UrgeLevel, Week } from '../api/types.ts'
import { checkedOff, inTheBank, placedOnDay, uncheckedOff } from './tasks.ts'

// Where a new task is expected to go: a week's bank (no day), or a day in it.
export type Place = { week: string; day: string | null }

// A queued change: the request it sends, and what it does to the week. `id` is
// the change's own; a new task's id is `taskId`, so sending it twice is one task.
export type Change =
  | { kind: 'checkOff'; id: string; taskId: string; checkOff: CheckOff }
  | { kind: 'uncheck'; id: string; taskId: string }
  | { kind: 'place'; id: string; taskId: string; week: string; day: string }
  | { kind: 'toBank'; id: string; taskId: string; week: string }
  | { kind: 'swap'; id: string; taskId: string; week: string; bankTaskId: string; day: string }
  | { kind: 'addTask'; id: string; taskId: string; task: NewTask; goalLabel: string | null; place: Place | null }
  | QuitChange

// A quitting goal's day: each states its end result, so sending it twice is the same.
export type QuitChange =
  | { kind: 'answerQuitDay'; id: string; goalId: string; day: string; held: boolean }
  | { kind: 'clearQuitDay'; id: string; goalId: string; day: string }
  | { kind: 'rateUrge'; id: string; goalId: string; day: string; level: UrgeLevel }
  | { kind: 'clearUrgeRating'; id: string; goalId: string; day: string }

export function replay(week: Week, changes: Change[]): Week {
  return changes.reduce(applyChange, week)
}

function applyChange(week: Week, change: Change): Week {
  switch (change.kind) {
    case 'checkOff':
      return withTask(week, change.taskId, (task) => checkedOff(task, change.checkOff))
    case 'uncheck':
      return withTask(week, change.taskId, uncheckedOff)
    case 'place':
      return change.week === week.week ? withTask(week, change.taskId, (task) => placedOnDay(task, change.day)) : week
    case 'toBank':
      return change.week === week.week ? withTask(week, change.taskId, inTheBank) : week
    case 'swap':
      return change.week === week.week ? swapped(week, change.taskId, change.bankTaskId, change.day) : week
    case 'addTask':
      return added(week, change)
    default:
      return withQuitDay(week, change)
  }
}

// The day as the change leaves it; the goal's other days, and other goals, as they were.
export function quitDayAfter(day: QuitDay, change: QuitChange): QuitDay {
  switch (change.kind) {
    case 'answerQuitDay':
      return { ...day, held: change.held }
    case 'clearQuitDay':
      return { ...day, held: null }
    case 'rateUrge':
      return { ...day, urge: change.level }
    case 'clearUrgeRating':
      return { ...day, urge: null }
  }
}

export function isQuitChange(change: Change): change is QuitChange {
  return ['answerQuitDay', 'clearQuitDay', 'rateUrge', 'clearUrgeRating'].includes(change.kind)
}

function withQuitDay(week: Week, change: QuitChange): Week {
  const goal = week.quittingGoals.find((candidate) => candidate.id === change.goalId)
  if (!goal?.days.some((day) => day.day === change.day)) return week
  return {
    ...week,
    quittingGoals: week.quittingGoals.map((candidate) =>
      candidate === goal
        ? { ...goal, days: goal.days.map((day) => (day.day === change.day ? quitDayAfter(day, change) : day)) }
        : candidate,
    ),
  }
}

function withTask(week: Week, taskId: string, change: (task: Task) => Task): Week {
  if (!week.tasks.some((task) => task.id === taskId)) return week
  return { ...week, tasks: week.tasks.map((task) => (task.id === taskId ? change(task) : task)) }
}

// The bank task takes the day task's place in the order, and the other way round.
function swapped(week: Week, taskId: string, bankTaskId: string, day: string): Week {
  const toBank = week.tasks.find((task) => task.id === taskId)
  const placed = week.tasks.find((task) => task.id === bankTaskId)
  if (!toBank || !placed) return week
  return {
    ...week,
    tasks: week.tasks.map((task) =>
      task.id === taskId ? placedOnDay(placed, day) : task.id === bankTaskId ? inTheBank(toBank) : task,
    ),
  }
}

// Shown where it's expected until the week read has it; then the server's copy shows.
function added(week: Week, change: Extract<Change, { kind: 'addTask' }>): Week {
  if (change.place?.week !== week.week || week.tasks.some((task) => task.id === change.taskId)) return week
  return { ...week, tasks: [...week.tasks, newTask(change.taskId, change.task, change.goalLabel, change.place)] }
}

function newTask(id: string, task: NewTask, goalLabel: string | null, place: Place): Task {
  return {
    id,
    title: task.title,
    origin: 'byHand',
    state: 'open',
    goalId: task.goalId ?? null,
    goalLabel,
    aspiration: null,
    recurringItemId: null,
    fixedDay: false,
    dueDate: task.dueDate ?? null,
    timeOfDay: task.timeOfDay ?? null,
    valueLogged: null,
    completedAt: null,
    completedOn: null,
    week: place.week,
    plannedDay: place.day,
    placedByHand: place.day !== null,
    carriedOver: 0,
    atClose: 'carriesOver',
    stillMatters: false,
  }
}

// Where the server is expected to put a new task, for showing it before the
// answer arrives (settled in spec 043b). The server still decides (ADR-008):
// its answer replaces this. `current` is the current week as last read.
export function predictedPlace(task: NewTask, current: Week | undefined, today: string): Place | null {
  if (task.day) return dayPlace(task.day, current, today)
  if (!current) return null
  const open = current.nextWeekOpen ? [current.week, weekAfter(current.week)] : [current.week]
  if (!task.dueDate) return { week: current.week, day: null }
  const dueWeek = mondayOfDay(task.dueDate)
  if (dueWeek <= current.week) return { week: current.week, day: null }
  return open.includes(dueWeek) ? { week: dueWeek, day: null } : null
}

// A day from today on, in the current week or later, is pinned there, whether or not its week is
// open or stored (API #50); a week the phone doesn't store isn't replayed, so then it only gives
// the line. A day before that goes in the current week's bank.
function dayPlace(day: string, current: Week | undefined, today: string): Place | null {
  const week = mondayOfDay(day)
  if (day >= today && (!current || week >= current.week)) return { week, day }
  return current ? { week: current.week, day: null } : null
}
