import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  answerStillMatters,
  checkOffTask,
  getBank,
  getDay,
  getWeek,
  NotFoundError,
  placeTask,
  wrapUpWeek,
} from './client.ts'
import { resetStore } from './mockStore.ts'
import { isInBank } from '../domain/tasks.ts'

const THIS_WEEK = '2026-11-09'
const NEXT_WEEK = '2026-11-16'

// Sunday 15 Nov 2026, just before and just after next week opens.
const SUNDAY_BEFORE = new Date(2026, 10, 15, 17, 59)
const SUNDAY_EVENING = new Date(2026, 10, 15, 18, 0)

function at(moment: Date) {
  vi.setSystemTime(moment)
}

beforeEach(() => {
  vi.useFakeTimers()
  at(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getWeek and next week', () => {
  it('says this week is current, and that next week is not open yet, on a Wednesday', async () => {
    const week = await getWeek()

    expect(week).toMatchObject({ weekOf: THIS_WEEK, isCurrent: true, nextWeekOpen: false })
    await expect(getWeek(NEXT_WEEK)).rejects.toThrow(NotFoundError)
  })

  it('opens next week from 6 p.m. on Sunday, not before', async () => {
    at(SUNDAY_BEFORE)
    expect((await getWeek()).nextWeekOpen).toBe(false)

    at(SUNDAY_EVENING)
    expect((await getWeek()).nextWeekOpen).toBe(true)
  })

  it('reads next week with tasks of its own, all in the bank', async () => {
    at(SUNDAY_EVENING)

    const next = await getWeek(NEXT_WEEK)

    expect(next).toMatchObject({ weekOf: NEXT_WEEK, isCurrent: false, nextWeekOpen: true })
    expect(next.tasks.length).toBeGreaterThan(0)
    expect(next.tasks.every((task) => task.week === NEXT_WEEK && isInBank(task))).toBe(true)
    expect(next.goals.length).toBeGreaterThan(0)
  })

  it("keeps next week's tasks out of this week's bank", async () => {
    at(SUNDAY_EVENING)

    const bank = await getBank()

    expect(bank.tasks.every((task) => task.week === THIS_WEEK)).toBe(true)
  })

  it("reads next week's bank once it's open, and not before", async () => {
    await expect(getBank(NEXT_WEEK)).rejects.toThrow(NotFoundError)

    at(SUNDAY_EVENING)
    const bank = await getBank(NEXT_WEEK)

    expect(bank.weekOf).toBe(NEXT_WEEK)
    expect(bank.tasks.length).toBeGreaterThan(0)
    expect(bank.tasks.every((task) => task.week === NEXT_WEEK)).toBe(true)
  })

  it('refuses to check off a task in next week, and lets it be placed', async () => {
    at(SUNDAY_EVENING)
    const [task] = (await getWeek(NEXT_WEEK)).tasks

    await expect(checkOffTask(task.id)).rejects.toThrow()
    await placeTask(task.id, NEXT_WEEK, '2026-11-17')

    const placed = (await getWeek(NEXT_WEEK)).tasks.find((candidate) => candidate.id === task.id)
    expect(placed).toMatchObject({ plannedDay: '2026-11-17', placedByHand: true })
  })
})

describe('what closing does', () => {
  it('says a by-hand task carries over, a goal session ends, and a done task has nothing', async () => {
    const { tasks } = await getWeek()
    const atClose = (id: string) => tasks.find((task) => task.id === id)?.atClose

    expect(atClose('task-dentist')).toBe('carriesOver')
    expect(atClose('task-lift-bank')).toBe('ends')
    expect(atClose('task-lift-mon')).toBeNull()
  })
})

describe('wrapUpWeek', () => {
  it('is refused until next week is open', async () => {
    await expect(wrapUpWeek(THIS_WEEK)).rejects.toThrow()
  })

  it("carries over what carries over, ends the rest, and makes next week the current one", async () => {
    at(SUNDAY_EVENING)

    const next = await wrapUpWeek(THIS_WEEK)

    expect(next).toMatchObject({ weekOf: NEXT_WEEK, isCurrent: true })
    const dentist = next.tasks.find((task) => task.id === 'task-dentist')
    expect(dentist).toMatchObject({ week: NEXT_WEEK, plannedDay: null, carriedOver: 3, state: 'open' })
    expect(next.tasks.map((task) => task.id)).not.toContain('task-lift-bank')
    expect((await getWeek()).weekOf).toBe(NEXT_WEEK)
  })

  it('changes nothing when sent again', async () => {
    at(SUNDAY_EVENING)
    const first = await wrapUpWeek(THIS_WEEK)

    const again = await wrapUpWeek(THIS_WEEK)

    expect(again.tasks.map((task) => task.id).sort()).toEqual(first.tasks.map((task) => task.id).sort())
  })

  it('refuses a week that is not the current one', async () => {
    at(SUNDAY_EVENING)

    await expect(wrapUpWeek(NEXT_WEEK)).rejects.toThrow()
  })
})

describe('answerStillMatters', () => {
  it("is listed with the day's plan, whichever day it's on", async () => {
    const day = await getDay('2026-11-11')

    expect(day.stillMatters.map((task) => task.id)).toEqual(['task-dentist'])
    await answerStillMatters('task-dentist', { answer: 'keep' })
    expect((await getDay('2026-11-11')).stillMatters).toEqual([])
  })

  it('marks a task that rolled over twice', async () => {
    const { tasks } = await getWeek()

    expect(tasks.find((task) => task.id === 'task-dentist')?.stillMatters).toBe(true)
  })

  it('keeps it, and stops asking', async () => {
    const kept = await answerStillMatters('task-dentist', { answer: 'keep' })

    expect(kept).toMatchObject({ state: 'open', stillMatters: false, week: THIS_WEEK })
  })

  it('schedules it on a day, placed by hand', async () => {
    const scheduled = await answerStillMatters('task-dentist', {
      answer: 'schedule',
      week: THIS_WEEK,
      day: '2026-11-13',
    })

    expect(scheduled).toMatchObject({ plannedDay: '2026-11-13', placedByHand: true, stillMatters: false })
  })

  it('drops it, and it leaves the week', async () => {
    const dropped = await answerStillMatters('task-dentist', { answer: 'drop' })

    expect(dropped.state).toBe('dropped')
    expect((await getWeek()).tasks.map((task) => task.id)).not.toContain('task-dentist')
  })

  it('refuses a task that is not asking', async () => {
    await expect(answerStillMatters('task-lift-bank', { answer: 'keep' })).rejects.toThrow()
  })
})
