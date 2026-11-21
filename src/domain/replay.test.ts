import { describe, expect, it } from 'vitest'
import type { Task, Week } from '../api/types.ts'
import { aTask } from '../test/tasks.ts'
import { predictedPlace, replay, type Change } from './replay.ts'

const WEEK = '2026-11-09'
const NEXT = '2026-11-16'
const TODAY = '2026-11-11'
const CHECK_OFF = { completedAt: '2026-11-11T16:00:00.000Z', completedOn: TODAY, valueLogged: null }

function weekOf(tasks: Task[], fields: Partial<Week> = {}): Week {
  return { week: WEEK, isCurrent: true, nextWeekOpen: false, tasks, goals: [], days: [], quittingGoals: [], ...fields }
}

const laundry = aTask('laundry', { plannedDay: TODAY, placedByHand: true })
const lift = aTask('lift', { plannedDay: '2026-11-12', placedByHand: true })
const ballot = aTask('ballot')

function where(week: Week): Record<string, string> {
  return Object.fromEntries(week.tasks.map((task) => [task.id, task.state === 'done' ? 'done' : (task.plannedDay ?? 'bank')]))
}

describe('replay', () => {
  it('leaves the week as it is with nothing queued, and never changes the stored one', () => {
    const stored = weekOf([laundry, ballot])
    const copy = structuredClone(stored)

    replay(stored, [{ kind: 'checkOff', id: 'c1', taskId: 'laundry', checkOff: CHECK_OFF }])

    expect(stored).toEqual(copy)
    expect(replay(stored, [])).toEqual(stored)
  })

  it('checks off and unchecks, in order', () => {
    const changes: Change[] = [
      { kind: 'checkOff', id: 'c1', taskId: 'laundry', checkOff: CHECK_OFF },
      { kind: 'uncheck', id: 'c2', taskId: 'laundry' },
      { kind: 'checkOff', id: 'c3', taskId: 'lift', checkOff: CHECK_OFF },
    ]

    const shown = replay(weekOf([laundry, lift]), changes)

    expect(where(shown)).toEqual({ laundry: TODAY, lift: 'done' })
    expect(shown.tasks[1]).toMatchObject({ completedAt: CHECK_OFF.completedAt, completedOn: TODAY })
  })

  it('places a task on a day, and sends one back to the bank', () => {
    const shown = replay(weekOf([laundry, ballot]), [
      { kind: 'place', id: 'c1', taskId: 'ballot', week: WEEK, day: '2026-11-13' },
      { kind: 'toBank', id: 'c2', taskId: 'laundry', week: WEEK },
    ])

    expect(where(shown)).toEqual({ laundry: 'bank', ballot: '2026-11-13' })
    expect(shown.tasks[1].placedByHand).toBe(true)
  })

  it('swaps, each taking the other one place in the order', () => {
    const shown = replay(weekOf([laundry, lift, ballot]), [
      { kind: 'swap', id: 'c1', taskId: 'laundry', week: WEEK, bankTaskId: 'ballot', day: TODAY },
    ])

    expect(shown.tasks.map((task) => task.id)).toEqual(['ballot', 'lift', 'laundry'])
    expect(where(shown)).toEqual({ ballot: TODAY, lift: '2026-11-12', laundry: 'bank' })
  })

  it('does nothing for a task not in the week, or a change made in another week', () => {
    const stored = weekOf([laundry, ballot])

    const shown = replay(stored, [
      { kind: 'checkOff', id: 'c1', taskId: 'gone', checkOff: CHECK_OFF },
      { kind: 'place', id: 'c2', taskId: 'ballot', week: NEXT, day: '2026-11-17' },
      { kind: 'swap', id: 'c3', taskId: 'laundry', week: WEEK, bankTaskId: 'gone', day: TODAY },
    ])

    expect(shown).toEqual(stored)
  })

  it('adds a new task where it was expected to go, once', () => {
    const add: Change = {
      kind: 'addTask',
      id: 'c1',
      taskId: 'new',
      task: { title: 'Call the vet', day: TODAY, dueDate: null, goalId: 'goal-strong', timeOfDay: null },
      goalLabel: 'Be strong',
      place: { week: WEEK, day: TODAY },
    }

    const shown = replay(weekOf([laundry]), [add])

    expect(shown.tasks.map((task) => task.id)).toEqual(['laundry', 'new'])
    expect(shown.tasks[1]).toMatchObject({
      title: 'Call the vet',
      origin: 'byHand',
      state: 'open',
      goalId: 'goal-strong',
      goalLabel: 'Be strong',
      week: WEEK,
      plannedDay: TODAY,
      placedByHand: true,
      atClose: 'carriesOver',
    })
    // Once the week read has it, the server's copy is what shows.
    expect(replay(weekOf([laundry, aTask('new', { title: 'From the server' })]), [add]).tasks.map((task) => task.title)).toEqual([
      'laundry',
      'From the server',
    ])
    expect(replay(weekOf([laundry], { week: NEXT }), [add]).tasks).toHaveLength(1)
  })
})

describe('predictedPlace', () => {
  const current = weekOf([], { nextWeekOpen: true })
  const task = { title: 'Call the vet', day: null, dueDate: null, goalId: null, timeOfDay: null }

  it('goes on the day it was added to, from today on in an open week', () => {
    expect(predictedPlace({ ...task, day: TODAY }, current, TODAY)).toEqual({ week: WEEK, day: TODAY })
    expect(predictedPlace({ ...task, day: '2026-11-17' }, current, TODAY)).toEqual({ week: NEXT, day: '2026-11-17' })
  })

  it("goes in this week's bank for a day no longer allowed", () => {
    expect(predictedPlace({ ...task, day: '2026-11-10' }, current, TODAY)).toEqual({ week: WEEK, day: null })
    expect(predictedPlace({ ...task, day: '2026-11-17' }, weekOf([]), TODAY)).toEqual({ week: WEEK, day: null })
  })

  it("goes in the bank of its due week, this week's when it's due now or overdue", () => {
    expect(predictedPlace(task, current, TODAY)).toEqual({ week: WEEK, day: null })
    expect(predictedPlace({ ...task, dueDate: '2026-11-01' }, current, TODAY)).toEqual({ week: WEEK, day: null })
    expect(predictedPlace({ ...task, dueDate: '2026-11-19' }, current, TODAY)).toEqual({ week: NEXT, day: null })
  })

  it('goes nowhere on the plan when due after the open weeks, or with no week known', () => {
    expect(predictedPlace({ ...task, dueDate: '2026-12-01' }, current, TODAY)).toBeNull()
    expect(predictedPlace({ ...task, dueDate: '2026-11-19' }, weekOf([]), TODAY)).toBeNull()
    expect(predictedPlace(task, undefined, TODAY)).toBeNull()
  })
})
