// The API's types where it has defined them, from the generated openapi.ts
// (`npm run api:types`); the rest are hand-written for the click-through until
// their screens move to the API, and follow ../docs/data-model.md.
// Days are local 'YYYY-MM-DD' strings; instants are full ISO timestamps.
import type { components } from './openapi.ts'

type Schemas = components['schemas']

// Empty fields are null. Only active aspirations have a position (1, 2, …
// with no gaps); only retired ones have retiredOn, a day.
export type Aspiration = Schemas['Aspiration']
export type AspirationStatus = Aspiration['status']

// Empty fields are null. weeklyTarget is the latest target (building goals
// only); slipped is worked out by the API: active, with its deadline passed.
export type Goal = Schemas['Goal']
export type GoalType = Goal['type']
export type GoalStatus = Goal['status']

// A goal as listGoals sends it, with "2 of 6": milestones hit plus the goal
// itself, which a reached goal fills.
export type ListedGoal = Schemas['ListedGoal']

export type MilestoneStatus = 'upcoming' | 'hit' | 'notYet'

export type Milestone = {
  id: string
  goalId: string
  measurableLine: string
  status: MilestoneStatus
  result?: string
  targetDate?: string
  checkedInOn?: string
}

// A count ("3 lifting sessions") or an amount ("25 miles over 4 runs"). The
// screens make count targets only for now (#32).
export type WeeklyTarget = Schemas['WeeklyTarget']
export type WeeklyTargetInput = Schemas['WeeklyTargetInput']

export type RecurringItem = {
  id: string
  name: string
  repeatRule: string
  fixedDay: boolean
  active: boolean
  nextDue: string
  aspirationId?: string
}

export type TaskStatus = 'inBank' | 'planned' | 'done' | 'skipped'

export type TimeOfDay = {
  kind: 'by' | 'at'
  time: string // 'HH:MM', 24-hour
}

export type Task = {
  id: string
  title: string
  status: TaskStatus
  weekOf: string
  plannedDay?: string
  dueDate?: string
  timeOfDay?: TimeOfDay
  goalId?: string
  recurringItemId?: string
  valueLogged?: number
  rolloverCount: number
  completedAt?: string
  // Set when the person puts the task on a day. The planner must never move it.
  placedByHand?: boolean
}

// What the Add sheet sends to addTask. Not stored as is: the API places it.
export type NewTask = {
  title: string
  goalId?: string
  dueDate?: string
  timeOfDay?: TimeOfDay
  onToday?: boolean
}

// What the Add sheet sends to addGoal. A building goal sends its target too.
export type NewGoal = Schemas['NewGoal']

// What the Add sheet sends to addAspiration. It goes last in priority.
export type NewAspiration = Schemas['AspirationInput']

// What the Add sheet sends to addRecurringItem. Without an aspiration it
// belongs to Keep life running.
export type NewRecurringItem = {
  name: string
  repeatRule: string
  fixedDay: boolean
  nextDue: string
  aspirationId?: string
}

export type Intensity = 'easingOff' | 'normal' | 'goingHard'

// Free time has no setting: it's whatever the intensity's task cap leaves open.
export type Settings = {
  intensity: Intensity
  intensitySetOn: string
  weekStartsOn: 'monday'
}

export type DayPlan = {
  date: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
}

// Every task in a week (planned, done and in the bank), with what they
// reference, and every active goal with a weekly target.
export type WeekPlan = {
  weekOf: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
}

// This week's tasks not yet on a day, with what they reference (like DayPlan).
export type Bank = {
  weekOf: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
}

// Everything the Aspirations tab shows, as records. Ordering, grouping and
// counting are left to domain/aspirations.ts.
export type AspirationsOverview = {
  aspirations: Aspiration[] // active and retired
  goals: ListedGoal[] // every status
  recurringItems: RecurringItem[] // active ones
  weekTasks: Task[] // this week's tasks that belong to a goal
}

// One aspiration's page, as records. Laid out by domain/aspiration.ts.
export type AspirationDetail = {
  aspiration: Aspiration
  goals: ListedGoal[] // its goals, every status
  recurringItems: RecurringItem[] // its items, active or not
  weekTasks: Task[] // this week's tasks for its goals
  activeCount: number // active aspirations, for "1st of 3"
}

// One goal's page, as records. Laid out by domain/goalDetail.ts.
export type GoalDetail = {
  goal: Goal
  aspiration?: Aspiration
  milestones: Milestone[] // in order
}

// Keep life running: what has to happen but rolls up to no goal or aspiration.
export type Upkeep = {
  recurringItems: RecurringItem[] // active, with no aspiration
  tasks: Task[] // not done, no goal and no recurring item, this week and later
}
