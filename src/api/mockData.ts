// The "Be fit / Be strong" example, built around a given day so the current
// week always has data. Only mockStore.ts imports this.
import { addDays, mondayOf, toLocalDay } from './dates.ts'
import type {
  Aspiration,
  Goal,
  Milestone,
  RecurringItem,
  Settings,
  Task,
  WeeklyTarget,
} from './types.ts'

export type MockData = {
  aspirations: Aspiration[]
  goals: Goal[]
  milestones: Milestone[]
  weeklyTargets: WeeklyTarget[]
  recurringItems: RecurringItem[]
  tasks: Task[]
  settings: Settings
}

export function buildMockData(today: Date): MockData {
  const monday = mondayOf(today)
  const weekOf = toLocalDay(monday)
  const day = (offsetFromMonday: number) => toLocalDay(addDays(monday, offsetFromMonday))
  const todayDay = toLocalDay(today)

  const aspirations: Aspiration[] = [
    {
      id: 'asp-fit',
      name: 'Be fit',
      why: 'So I can keep skiing, biking and playing hockey at a high level for decades.',
      priority: 1,
      status: 'active',
      createdAt: '2026-10-01T09:00:00Z',
    },
    {
      id: 'asp-home',
      name: 'Keep a calm home',
      priority: 2,
      status: 'active',
      createdAt: '2026-10-01T09:05:00Z',
    },
    {
      id: 'asp-spanish',
      name: 'Speak Spanish',
      why: 'So I can talk with the family in Valencia.',
      status: 'retired',
      createdAt: '2026-03-02T09:00:00Z',
      retiredAt: '2026-09-15T09:00:00Z',
    },
  ]

  const goals: Goal[] = [
    {
      id: 'goal-strong',
      label: 'Be strong',
      measurableLine: 'Bench 175, squat 350, deadlift 400',
      type: 'building',
      baseline: 'Bench 145, squat 275, deadlift 315',
      status: 'active',
      startDate: '2026-10-05',
      aspirationId: 'asp-fit',
    },
    {
      id: 'goal-garage',
      label: 'Clear out the garage',
      measurableLine: 'The car fits in the garage',
      type: 'oneOff',
      status: 'active',
      startDate: '2026-11-02',
      deadline: toLocalDay(addDays(monday, 25)),
      aspirationId: 'asp-home',
    },
    {
      id: 'goal-endurance',
      label: 'Have endurance',
      measurableLine: 'Run 10k in under 50 minutes',
      type: 'building',
      baseline: '5k in 31 minutes',
      status: 'active',
      startDate: '2026-10-12',
      aspirationId: 'asp-fit',
    },
    {
      id: 'goal-look-good',
      label: 'Look good',
      measurableLine: 'Body fat at 15%',
      type: 'building',
      baseline: 'Body fat at 21%',
      status: 'active',
      startDate: '2026-10-12',
      aspirationId: 'asp-fit',
    },
    {
      id: 'goal-5k',
      label: 'Run a 5k',
      measurableLine: 'Finish a 5k without walking',
      type: 'building',
      status: 'reached',
      startDate: '2026-08-03',
      endedAt: '2026-10-10',
      aspirationId: 'asp-fit',
    },
    {
      id: 'goal-cook',
      label: 'Cook at home',
      measurableLine: 'Cook dinner at home 5 nights a week',
      type: 'building',
      status: 'paused',
      startDate: '2026-10-05',
      aspirationId: 'asp-home',
    },
    {
      id: 'goal-passport',
      label: 'Renew my passport',
      measurableLine: 'New passport in hand',
      type: 'oneOff',
      status: 'active',
      startDate: '2026-11-02',
      deadline: toLocalDay(addDays(monday, 40)),
    },
    {
      id: 'goal-taxes',
      label: 'File my taxes',
      measurableLine: 'Return filed and accepted',
      type: 'oneOff',
      status: 'reached',
      startDate: '2026-02-01',
      endedAt: '2026-04-06',
    },
    {
      id: 'goal-spanish-a2',
      label: 'Hold a conversation',
      measurableLine: 'Pass the A2 exam',
      type: 'building',
      status: 'reached',
      startDate: '2026-03-02',
      endedAt: '2026-08-20',
      aspirationId: 'asp-spanish',
    },
  ]

  const milestones: Milestone[] = [
    {
      id: 'ms-strong-1',
      goalId: 'goal-strong',
      measurableLine: 'Bench 150, squat 285, deadlift 325',
      status: 'hit',
      result: 'Bench 150, squat 290, deadlift 330',
      targetDate: '2026-11-02',
      checkedInOn: '2026-11-02',
    },
    {
      id: 'ms-strong-2',
      goalId: 'goal-strong',
      measurableLine: 'Bench 155, squat 300, deadlift 345',
      status: 'notYet',
      result: 'Bench 152, squat 300, deadlift 340',
      targetDate: day(-3),
      checkedInOn: day(-3),
    },
    {
      id: 'ms-strong-3',
      goalId: 'goal-strong',
      measurableLine: 'Bench 160, squat 310, deadlift 355',
      status: 'upcoming',
      targetDate: toLocalDay(addDays(monday, 21)),
    },
    upcoming('ms-strong-4', 'goal-strong', 'Bench 165, squat 325, deadlift 370'),
    upcoming('ms-strong-5', 'goal-strong', 'Bench 170, squat 340, deadlift 385'),
    hit('ms-endurance-1', 'goal-endurance', 'Run 5k without stopping', '2026-10-19'),
    hit('ms-endurance-2', 'goal-endurance', 'Run 10k, any pace', '2026-11-02'),
    upcoming('ms-endurance-3', 'goal-endurance', 'Run 10k in under 55 minutes'),
    upcoming('ms-look-good-1', 'goal-look-good', 'Body fat at 19%'),
    upcoming('ms-look-good-2', 'goal-look-good', 'Body fat at 17%'),
    // A one-off goal's milestones are its steps.
    hit('ms-garage-1', 'goal-garage', 'Empty the left wall', '2026-11-03'),
    hit('ms-garage-2', 'goal-garage', 'Sort into keep, donate and dump', '2026-11-05'),
    hit('ms-garage-3', 'goal-garage', 'Sell the table saw', '2026-11-07'),
    upcoming('ms-garage-4', 'goal-garage', 'Donate and dump the rest'),
    upcoming('ms-garage-5', 'goal-garage', 'Put up the shelves'),
  ]

  const weeklyTargets: WeeklyTarget[] = [
    {
      id: 'wt-strong',
      goalId: 'goal-strong',
      amount: 3,
      unit: 'lifting sessions',
      effectiveFrom: '2026-10-05',
    },
    {
      id: 'wt-endurance',
      goalId: 'goal-endurance',
      amount: 2,
      unit: 'runs',
      effectiveFrom: '2026-10-12',
    },
  ]

  const recurringItems: RecurringItem[] = [
    {
      id: 'rec-trash',
      name: 'Take out the trash',
      repeatRule: 'Every Tuesday',
      fixedDay: true,
      active: true,
      nextDue: day(1),
      aspirationId: 'asp-home',
    },
    {
      id: 'rec-laundry',
      name: 'Laundry',
      repeatRule: 'Once a week',
      fixedDay: false,
      active: true,
      nextDue: day(6),
      aspirationId: 'asp-home',
    },
    {
      id: 'rec-rent',
      name: 'Pay rent',
      repeatRule: 'Monthly on the 1st',
      fixedDay: true,
      active: true,
      nextDue: toLocalDay(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
    },
    {
      id: 'rec-stretch',
      name: 'Stretch',
      repeatRule: '3 times a week',
      fixedDay: false,
      active: true,
      nextDue: day(4),
      aspirationId: 'asp-fit',
    },
    {
      id: 'rec-hockey',
      name: 'Hockey',
      repeatRule: 'Every Sunday',
      fixedDay: true,
      active: true,
      nextDue: day(6),
      aspirationId: 'asp-fit',
    },
  ]

  const tasks: Task[] = [
    {
      id: 'task-lift-mon',
      title: 'Lift: squat day',
      status: 'done',
      weekOf,
      plannedDay: day(0),
      goalId: 'goal-strong',
      rolloverCount: 0,
      completedAt: atTime(monday, 18, 40),
    },
    {
      id: 'task-run-mon',
      title: 'Run: easy 5k',
      status: 'done',
      weekOf,
      plannedDay: day(0),
      goalId: 'goal-endurance',
      rolloverCount: 0,
      completedAt: atTime(monday, 7, 10),
    },
    {
      id: 'task-trash',
      title: 'Take out the trash',
      status: 'planned',
      weekOf,
      plannedDay: day(1),
      timeOfDay: { kind: 'by', time: '07:00' },
      recurringItemId: 'rec-trash',
      rolloverCount: 0,
    },
    {
      id: 'task-move-car',
      title: 'Move the car for street sweeping',
      status: 'planned',
      weekOf,
      plannedDay: todayDay,
      timeOfDay: { kind: 'by', time: '07:00' },
      rolloverCount: 0,
    },
    {
      id: 'task-lift-today',
      title: 'Lift: bench day',
      status: 'planned',
      weekOf,
      plannedDay: todayDay,
      timeOfDay: { kind: 'at', time: '18:00' },
      goalId: 'goal-strong',
      rolloverCount: 0,
    },
    {
      id: 'task-laundry',
      title: 'Laundry',
      status: 'planned',
      weekOf,
      plannedDay: todayDay,
      recurringItemId: 'rec-laundry',
      rolloverCount: 0,
    },
    {
      id: 'task-ballot',
      title: 'Fill out my ballot',
      status: 'planned',
      weekOf,
      plannedDay: todayDay,
      dueDate: toLocalDay(addDays(today, 2)),
      rolloverCount: 0,
    },
    {
      id: 'task-plan-mon',
      title: 'Plan the week',
      status: 'done',
      weekOf,
      plannedDay: day(0),
      rolloverCount: 0,
      completedAt: atTime(monday, 8, 15),
    },
    {
      id: 'task-groceries',
      title: 'Groceries',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      rolloverCount: 0,
    },
    // A busy Thursday, for checking long lists, scrolling and row menus.
    {
      id: 'task-plants',
      title: 'Water the plants',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      timeOfDay: { kind: 'by', time: '08:00' },
      rolloverCount: 0,
    },
    {
      id: 'task-dentist-appt',
      title: 'Dentist appointment',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      timeOfDay: { kind: 'at', time: '10:30' },
      rolloverCount: 0,
    },
    {
      id: 'task-library',
      title: 'Return library books',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      rolloverCount: 0,
    },
    {
      id: 'task-plumber',
      title: 'Call the plumber about the kitchen sink',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      rolloverCount: 0,
    },
    {
      id: 'task-dry-cleaning',
      title: 'Pick up dry cleaning',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      timeOfDay: { kind: 'by', time: '17:00' },
      rolloverCount: 0,
    },
    {
      id: 'task-donate-bikes',
      title: 'Donate the old bikes',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      goalId: 'goal-garage',
      rolloverCount: 0,
    },
    {
      id: 'task-sweep-garage',
      title: 'Sweep the garage floor',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      goalId: 'goal-garage',
      rolloverCount: 0,
    },
    {
      id: 'task-lease',
      title: 'Reply to the landlord about renewing the lease before the end of the month',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      rolloverCount: 0,
    },
    {
      id: 'task-backup',
      title: 'Back up the laptop',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      rolloverCount: 0,
    },
    {
      id: 'task-meal-prep',
      title: 'Meal prep for the weekend',
      status: 'planned',
      weekOf,
      plannedDay: day(3),
      timeOfDay: { kind: 'at', time: '19:00' },
      rolloverCount: 0,
    },
    {
      id: 'task-dump',
      title: 'Haul boxes to the dump',
      status: 'planned',
      weekOf,
      plannedDay: day(4),
      goalId: 'goal-garage',
      rolloverCount: 0,
      placedByHand: true,
    },
    {
      id: 'task-bathroom',
      title: 'Clean the bathroom',
      status: 'planned',
      weekOf,
      plannedDay: day(5),
      rolloverCount: 0,
    },
    {
      id: 'task-lift-bank',
      title: 'Lift: deadlift day',
      status: 'inBank',
      weekOf,
      goalId: 'goal-strong',
      rolloverCount: 0,
    },
    {
      id: 'task-garage-shelves',
      title: 'Sort the garage shelves',
      status: 'inBank',
      weekOf,
      goalId: 'goal-garage',
      rolloverCount: 0,
    },
    {
      id: 'task-dentist',
      title: 'Call the dentist',
      status: 'inBank',
      weekOf,
      rolloverCount: 2,
    },
    {
      id: 'task-run-bank',
      title: 'Run: intervals',
      status: 'inBank',
      weekOf,
      goalId: 'goal-endurance',
      rolloverCount: 0,
    },
  ]

  const settings: Settings = {
    intensity: 'normal',
    intensitySetOn: '2026-10-01',
    weekStartsOn: 'monday',
  }

  return { aspirations, goals, milestones, weeklyTargets, recurringItems, tasks, settings }
}

function hit(id: string, goalId: string, measurableLine: string, on: string): Milestone {
  return { id, goalId, measurableLine, status: 'hit', targetDate: on, checkedInOn: on }
}

function upcoming(id: string, goalId: string, measurableLine: string): Milestone {
  return { id, goalId, measurableLine, status: 'upcoming' }
}

function atTime(day: Date, hours: number, minutes: number): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).toISOString()
}
