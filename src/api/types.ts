// The API's types where it has defined them, from the generated openapi.ts
// (`npm run api:types`); the rest are hand-written for the click-through until
// their screens move to the API, and follow ../docs/data-model.md.
// Days are local 'YYYY-MM-DD' strings; instants are full ISO timestamps.
import type { components } from './openapi.ts'

type Schemas = components['schemas']

// What the phone saw when a task was checked off: the moment, and the local day
// it counts for (12:30 a.m. is the new day). Made once, at the tap, and sent as
// it was, even if the save happens later.
export type CheckOff = Schemas['CheckOff']

// What the browser's passkey functions take, as JSON, and the challenge to
// send back with the passkey made or used.
export type PasskeyOptions = Schemas['PasskeyOptions']

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

// What "Still matter?" sends: keep it, put it on a day (as placeTask does), or drop it.
export type StillMattersAnswer = Schemas['KeepIt'] | Schemas['ScheduleIt'] | Schemas['DropIt']

// What the Add sheet sends to addTask. With a day it's placed there by hand; a day no longer
// allowed, or none, saves it in a bank. The server picks the week from the due date.
export type NewTask = Schemas['NewTask']

// What the Add sheet sends to createGoal. A building goal sends its target too.
export type NewGoal = Schemas['NewGoal']

// What Move the date and Adjust the milestone send: the line and date, whole.
export type MilestoneEdit = Schemas['MilestoneEdit']

// What the Add sheet sends to addAspiration. It goes last in priority.
export type NewAspiration = Schemas['AspirationInput']

// What the Add sheet sends to addRecurringItem. Without an aspiration it
// belongs to Keep life running.
export type NewRecurringItem = Schemas['NewRecurringItem']

// Free time has no setting: it's whatever the intensity's task cap leaves open.
// Weeks always start Monday, so that's no setting either.
export type Settings = Schemas['Settings']
export type Intensity = Settings['intensity']

// The plan read (ADR-010): every task in a week, on a day then in the bank, done ones
// included; each active building goal with a target that week and its progress; each day's
// cap and whether it's full; and the quitting goals' days (#37). Today, any day and the bank
// are drawn from it.
export type Week = Schemas['Week']
export type WeekGoal = Schemas['WeekGoal']

// Everything the Aspirations tab shows, as records. Ordering, grouping and
// counting are left to domain/aspirations.ts.
export type AspirationsOverview = {
  aspirations: Aspiration[] // active and retired
  goals: ListedGoal[] // every status
  recurringItems: RecurringItem[] // active ones
  weekGoals: WeekGoal[] // the current week's goals, as its read sends them, with their progress
}

// One aspiration's page, as records. Laid out by domain/aspiration.ts.
export type AspirationDetail = {
  aspiration: Aspiration
  goals: ListedGoal[] // its goals, every status
  recurringItems: RecurringItem[] // its items, active or not
  weekGoals: WeekGoal[] // the current week's goals under it, with their progress
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
