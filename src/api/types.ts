// Hand-written for the click-through. Replaced by types generated from the
// API's OpenAPI schema once it exists; shapes follow ../docs/data-model.md.
// Days are local 'YYYY-MM-DD' strings; instants are full ISO timestamps.

export type AspirationStatus = 'active' | 'retired'

export type Aspiration = {
  id: string
  name: string
  why?: string
  // Active aspirations only, numbered 1, 2, … with no gaps: it's the position.
  priority?: number
  status: AspirationStatus
  createdAt: string
  retiredAt?: string
}

export type GoalType = 'building' | 'quitting' | 'oneOff'
export type GoalStatus = 'active' | 'paused' | 'reached' | 'ended'

export type Goal = {
  id: string
  label: string
  measurableLine: string
  type: GoalType
  baseline?: string
  status: GoalStatus
  startDate: string
  deadline?: string
  lastReviewedAt?: string
  endedAt?: string // a day, set when reached or ended
  aspirationId?: string
}

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

// A change adds a new row with a later effectiveFrom, so history is kept.
export type WeeklyTarget = {
  id: string
  goalId: string
  amount: number
  unit: string
  effectiveFrom: string
}

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

// What the Add sheet sends to addGoal. Status and ids are the API's.
export type NewGoal = {
  label: string
  measurableLine: string
  type: GoalType
  aspirationId?: string
  baseline?: string
  startDate?: string // today when left out
  deadline?: string
  weeklyTarget?: { amount: number; unit: string } // building only
}

// What the Add sheet sends to addAspiration. It goes last in priority.
export type NewAspiration = { name: string; why?: string }

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
// reference and each active goal's current weekly target.
export type WeekPlan = {
  weekOf: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
  weeklyTargets: WeeklyTarget[]
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
  goals: Goal[] // every status
  milestones: Milestone[] // for those goals, in each goal's order
  recurringItems: RecurringItem[] // active ones
  weeklyTargets: WeeklyTarget[] // the target in force this week, per active goal
  weekTasks: Task[] // this week's tasks that belong to a goal
}

// One aspiration's page, as records. Laid out by domain/aspiration.ts.
export type AspirationDetail = {
  aspiration: Aspiration
  goals: Goal[] // its goals, every status
  milestones: Milestone[] // for those goals, in each goal's order
  recurringItems: RecurringItem[] // its items, active or not
  weeklyTargets: WeeklyTarget[] // the target in force this week, per active goal
  weekTasks: Task[] // this week's tasks for its goals
  activeCount: number // active aspirations, for "1st of 3"
}

// One goal's page, as records. Laid out by domain/goalDetail.ts.
export type GoalDetail = {
  goal: Goal
  aspiration?: Aspiration
  milestones: Milestone[] // in order
  weeklyTarget?: WeeklyTarget // in force this week, whatever the goal's status
}

// Keep life running: what has to happen but rolls up to no goal or aspiration.
export type Upkeep = {
  recurringItems: RecurringItem[] // active, with no aspiration
  tasks: Task[] // not done, no goal and no recurring item, this week and later
}
