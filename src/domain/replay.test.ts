import { describe, expect, it } from 'vitest'
import type { Task, Week } from '../api/types.ts'
import { aTask } from '../test/tasks.ts'
import { predictedPlace, replay, type Change } from './replay.ts'
import { aWeekRead } from '../test/weeks.ts'

const WEEK = '2026-11-09'
const NEXT = '2026-11-16'
const TODAY = '2026-11-11'
const CHECK_OFF = { completedAt: '2026-11-11T16:00:00.000Z', completedOn: TODAY, valueLogged: null }

function weekOf(tasks: Task[], fields: Partial<Week> = {}): Week {
  return aWeekRead({ week: WEEK, tasks, ...fields })
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

  it('takes a task moved to a day in another week out of its week', () => {
    const shown = replay(weekOf([laundry, ballot]), [
      { kind: 'place', id: 'c1', taskId: 'laundry', week: WEEK, day: '2026-12-02', task: laundry },
    ])

    expect(where(shown)).toEqual({ ballot: 'bank' })
  })

  it('puts a task moved from another week on its day, when this week is the day\'s', () => {
    const next = aWeekRead({ week: NEXT, tasks: [] })
    const moved = { ...laundry, title: 'Laundry' }

    const shown = replay(next, [{ kind: 'place', id: 'c1', taskId: 'laundry', week: WEEK, day: '2026-11-17', task: moved }])

    expect(shown.tasks).toEqual([{ ...moved, week: NEXT, plannedDay: '2026-11-17', placedByHand: true }])
  })

  it("doesn't add a moved task twice, nor one queued without its task", () => {
    const next = aWeekRead({ week: NEXT, tasks: [aTask('laundry', { week: NEXT, plannedDay: '2026-11-18' })] })

    const shown = replay(next, [
      { kind: 'place', id: 'c1', taskId: 'laundry', week: WEEK, day: '2026-11-17', task: laundry },
      { kind: 'place', id: 'c2', taskId: 'lift', week: WEEK, day: '2026-11-17' },
    ])

    expect(where(shown)).toEqual({ laundry: '2026-11-18' })
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

  describe('a quitting goal\'s days', () => {
    const MON = '2026-11-09'
    const TUE = '2026-11-10'
    const quitting = {
      id: 'sugar',
      label: 'Quit sugar',
      days: [
        { goalId: 'sugar', day: MON, held: true, urge: 'some' as const },
        { goalId: 'sugar', day: TUE, held: null, urge: null },
      ],
    }
    const daysOf = (week: Week) => week.quittingGoals[0].days.map(({ held, urge }) => ({ held, urge }))

    it('answers, rates, and clears each, leaving the other half of the day', () => {
      const shown = replay(weekOf([], { quittingGoals: [quitting] }), [
        { kind: 'answerQuitDay', id: 'c1', goalId: 'sugar', day: TUE, held: false },
        { kind: 'rateUrge', id: 'c2', goalId: 'sugar', day: TUE, level: 'strong' },
        { kind: 'clearQuitDay', id: 'c3', goalId: 'sugar', day: MON },
      ])
      expect(daysOf(shown)).toEqual([
        { held: null, urge: 'some' },
        { held: false, urge: 'strong' },
      ])

      const cleared = replay(shown, [{ kind: 'clearUrgeRating', id: 'c4', goalId: 'sugar', day: TUE }])
      expect(daysOf(cleared)[1]).toEqual({ held: false, urge: null })
    })

    it('does nothing when the goal or the day is not in the week', () => {
      const week = weekOf([], { quittingGoals: [quitting] })
      const shown = replay(week, [
        { kind: 'answerQuitDay', id: 'c1', goalId: 'smoking', day: MON, held: true },
        { kind: 'answerQuitDay', id: 'c2', goalId: 'sugar', day: '2026-11-02', held: true },
      ])
      expect(shown).toEqual(week)
    })
  })
})

describe('predictedPlace', () => {
  const current = weekOf([], { nextWeekOpen: true })
  const task = { title: 'Call the vet', day: null, dueDate: null, goalId: null, timeOfDay: null }

  it('goes on the day it was added to, from today on in an open week', () => {
    expect(predictedPlace({ ...task, day: TODAY }, current, TODAY)).toEqual({ week: WEEK, day: TODAY })
    expect(predictedPlace({ ...task, day: '2026-11-17' }, current, TODAY)).toEqual({ week: NEXT, day: '2026-11-17' })
  })

  // The server pins it to its day in any week from the current one on (API #50). A week the
  // phone doesn't store isn't replayed, so this only gives the line.
  it('goes on its day in a week not yet open, or with no week known', () => {
    expect(predictedPlace({ ...task, day: '2026-11-17' }, weekOf([]), TODAY)).toEqual({ week: NEXT, day: '2026-11-17' })
    expect(predictedPlace({ ...task, day: '2026-12-12' }, current, TODAY)).toEqual({ week: '2026-12-07', day: '2026-12-12' })
    expect(predictedPlace({ ...task, day: '2026-12-12' }, undefined, TODAY)).toEqual({ week: '2026-12-07', day: '2026-12-12' })
  })

  it("goes in this week's bank for a day before today", () => {
    expect(predictedPlace({ ...task, day: '2026-11-10' }, current, TODAY)).toEqual({ week: WEEK, day: null })
  })

  it("goes in the current week's bank for a day before it, after a wrap-up", () => {
    const wrappedUp = weekOf([], { week: NEXT })
    expect(predictedPlace({ ...task, day: '2026-11-13' }, wrappedUp, TODAY)).toEqual({ week: NEXT, day: null })
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
