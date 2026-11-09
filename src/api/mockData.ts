// The "Be fit / Be strong" example, built around a given day so the current
// week always has data. Only mockStore.ts imports this.
import { addDays, mondayOf, toLocalDay } from './dates.ts'
import type { Aspiration, Goal, RecurringItem, Task } from './types.ts'

export type MockData = {
  aspirations: Aspiration[]
  goals: Goal[]
  recurringItems: RecurringItem[]
  tasks: Task[]
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
      completedAt: `${day(0)}T18:40:00`,
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
  ]

  return { aspirations, goals, recurringItems, tasks }
}
