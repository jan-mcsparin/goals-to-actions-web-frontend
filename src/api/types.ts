// Hand-written for the click-through. Replaced by types generated from the
// API's OpenAPI schema once it exists; shapes follow ../docs/data-model.md.
// Days are local 'YYYY-MM-DD' strings; instants are full ISO timestamps.

export type Aspiration = {
  id: string
  name: string
  why?: string
  priority: number
  createdAt: string
  lastReviewedAt?: string
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
  endedAt?: string
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
}

export type Intensity = 'easingOff' | 'normal' | 'goingHard'

// Free time has no setting: it's whatever the intensity's task cap leaves open.
export type Settings = {
  intensity: Intensity
  intensitySetOn: string
  weekStartsOn: 'monday'
}

export type TodayPlan = {
  date: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
}

// This week's tasks not yet on a day, with what they reference (like TodayPlan).
export type Bank = {
  weekOf: string
  tasks: Task[]
  goals: Goal[]
  aspirations: Aspiration[]
  recurringItems: RecurringItem[]
}
