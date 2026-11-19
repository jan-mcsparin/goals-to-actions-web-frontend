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

// In the goal's order (position 1, 2, …). result is its latest check-in's,
// hit or not yet; null while it's upcoming.
export type Milestone = Schemas['Milestone']
export type MilestoneStatus = Milestone['status']

// A count ("3 lifting sessions") or an amount ("25 miles over 4 runs"). The
// screens make count targets only for now (#32).
export type WeeklyTarget = Schemas['WeeklyTarget']
export type WeeklyTargetInput = Schemas['WeeklyTargetInput']

// Weekly on a weekday, monthly on a day from the 1st to the 28th, or flexible:
// 1 to 6 times a week, or once every two weeks or once a month.
export type Schedule = Schemas['RecurringItem']['schedule']

// Planned as goal work under its aspiration; with none (null), maintenance in
// Keep life running. startsOn is the first day it can be due.
export type RecurringItem = Schemas['RecurringItem']

export type TimeOfDay = Schemas['TimeOfDay']

// A task as the API sends it. `plannedDay` is empty in the bank, and `week` is empty while it
// waits (the upcoming list) or is set aside.
export type Task = Schemas['Task']

// What the Add sheet sends to addTask. Not stored as is: the API places it.
export type NewTask = {
  title: string
  goalId?: string
  dueDate?: string
  timeOfDay?: TimeOfDay
  onToday?: boolean
}

// What the Add sheet sends to createGoal. A building goal sends its target too.
export type NewGoal = Schemas['NewGoal']

// What Move the date and Adjust the milestone send: the line and date, whole.
export type MilestoneEdit = Schemas['MilestoneEdit']

// What the Add sheet sends to addAspiration. It goes last in priority.
export type NewAspiration = Schemas['AspirationInput']

// What the Add sheet sends to addRecurringItem. Without an aspiration it
// belongs to Keep life running.
export type NewRecurringItem = Schemas['NewRecurringItem']

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
// The API's page: the goal, its aspiration's name, its milestones, "2 of 6"
// (a reached goal complete) and the latest check-in with a result.
export type GoalDetail = Schemas['GoalPage']
export type AspirationRef = Schemas['AspirationRef']

// Keep life running: what has to happen but rolls up to no goal or aspiration.
export type Upkeep = {
  recurringItems: RecurringItem[] // active, with no aspiration
  tasks: Task[] // not done, no goal and no recurring item, this week and later
}
