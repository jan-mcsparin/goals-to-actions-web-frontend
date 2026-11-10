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
      createdAt: '2026-10-01T09:00:00Z',
    },
    {
      id: 'asp-home',
      name: 'Keep a calm home',
      priority: 2,
      createdAt: '2026-10-01T09:05:00Z',
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
      status: 'upcoming',
      targetDate: toLocalDay(addDays(monday, 21)),
    },
    {
      id: 'ms-strong-3',
      goalId: 'goal-strong',
      measurableLine: 'Bench 165, squat 325, deadlift 370',
      status: 'upcoming',
    },
  ]

  const weeklyTargets: WeeklyTarget[] = [
    {
      id: 'wt-strong',
      goalId: 'goal-strong',
      amount: 3,
      unit: 'lifting sessions',
      effectiveFrom: '2026-10-05',
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
  ]

  const settings: Settings = {
    intensity: 'normal',
    intensitySetOn: '2026-10-01',
    weekStartsOn: 'monday',
  }

  return { aspirations, goals, milestones, weeklyTargets, recurringItems, tasks, settings }
}

function atTime(day: Date, hours: number, minutes: number): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).toISOString()
}
