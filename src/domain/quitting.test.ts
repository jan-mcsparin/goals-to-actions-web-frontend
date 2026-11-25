import { describe, expect, it } from 'vitest'
import type { QuitDay, QuitRecord, Week } from '../api/types.ts'
import { quitRows, recordDays, runLine, URGE_CHOICES, withQueuedQuitDays } from './quitting.ts'

const TODAY = '2026-11-11'

function day(date: string, held: boolean | null = null, urge: QuitDay['urge'] = null, goalId = 'sugar'): QuitDay {
  return { goalId, day: date, held, urge }
}

function weekWith(quittingGoals: Week['quittingGoals']): Week {
  return { week: '2026-11-09', isCurrent: true, nextWeekOpen: false, tasks: [], goals: [], days: [], quittingGoals }
}

const week = weekWith([
  { id: 'sugar', label: 'Quit sugar', days: [day('2026-11-10', true, 'low'), day(TODAY), day('2026-11-12')] },
  { id: 'smoking', label: 'Quit smoking', days: [day(TODAY, false, null, 'smoking')] },
])

describe('quitRows', () => {
  it("gives each quitting goal's day: unanswered, held or slipped, with its urge", () => {
    expect(quitRows(week, TODAY, TODAY)).toEqual([
      { goalId: 'sugar', label: 'Quit sugar', day: TODAY, answer: 'unanswered', urge: null },
      { goalId: 'smoking', label: 'Quit smoking', day: TODAY, answer: 'slipped', answerLabel: 'Slipped', urge: null },
    ])
    expect(quitRows(week, '2026-11-10', TODAY)).toEqual([
      { goalId: 'sugar', label: 'Quit sugar', day: '2026-11-10', answer: 'held', answerLabel: 'Held', urge: 'low' },
    ])
  })

  it('offers nothing on a future day, or a day before the goal started', () => {
    expect(quitRows(week, '2026-11-12', TODAY)).toEqual([])
    expect(quitRows(week, '2026-11-09', TODAY)).toEqual([])
  })
})

describe('URGE_CHOICES', () => {
  it('reads Low · Some · Strong', () => {
    expect(URGE_CHOICES.map((choice) => choice.label)).toEqual(['Low', 'Some', 'Strong'])
  })
})

describe('runLine', () => {
  const record = (heldRun: number, unknownInRun: number): QuitRecord => ({ days: [], heldRun, unknownInRun })

  it('counts the days held, and the days not answered while there are any', () => {
    expect(runLine(record(12, 0))).toBe('12 days held')
    expect(runLine(record(1, 0))).toBe('1 day held')
    expect(runLine(record(12, 2))).toBe('12 days held · 2 not answered')
    expect(runLine(record(3, 1))).toBe('3 days held · 1 not answered')
  })

  it('says "not yet" for a run that has none', () => {
    expect(runLine(record(0, 0))).toBe('No days held yet')
    expect(runLine(record(0, 2))).toBe('No days held yet · 2 not answered')
  })
})

describe('recordDays', () => {
  it('words each day newest first: Held, Slipped, or a dash, never a slip, with the urge', () => {
    const record: QuitRecord = {
      days: [day(TODAY), day('2026-11-10', true, 'strong'), day('2026-11-09', false), day('2026-11-08', null, 'some')],
      heldRun: 0,
      unknownInRun: 1,
    }

    expect(recordDays(record, TODAY)).toEqual([
      { day: TODAY, dayLabel: 'Today', answerLabel: '–', answered: false, urge: null },
      { day: '2026-11-10', dayLabel: 'Yesterday', answerLabel: 'Held', answered: true, urge: 'strong', urgeLabel: 'Strong urge' },
      { day: '2026-11-09', dayLabel: 'Mon, Nov 9', answerLabel: 'Slipped', answered: true, urge: null },
      { day: '2026-11-08', dayLabel: 'Sun, Nov 8', answerLabel: '–', answered: false, urge: 'some', urgeLabel: 'Some urge' },
    ])
  })
})

describe('withQueuedQuitDays', () => {
  const record: QuitRecord = { days: [day(TODAY), day('2026-11-10', true)], heldRun: 1, unknownInRun: 0 }

  it("shows this goal's queued answers and ratings on their days, leaving the run to the server", () => {
    const shown = withQueuedQuitDays(record, 'sugar', [
      { kind: 'answerQuitDay', id: 'c1', goalId: 'sugar', day: TODAY, held: true },
      { kind: 'rateUrge', id: 'c2', goalId: 'sugar', day: TODAY, level: 'some' },
      { kind: 'clearQuitDay', id: 'c3', goalId: 'sugar', day: '2026-11-10' },
      { kind: 'answerQuitDay', id: 'c4', goalId: 'smoking', day: TODAY, held: false },
      { kind: 'uncheck', id: 'c5', taskId: 't1' },
    ])

    expect(shown.days).toEqual([day(TODAY, true, 'some'), day('2026-11-10')])
    expect(shown).toMatchObject({ heldRun: 1, unknownInRun: 0 })
  })

  it('does nothing for a day not on the record', () => {
    expect(withQueuedQuitDays(record, 'sugar', [{ kind: 'answerQuitDay', id: 'c1', goalId: 'sugar', day: '2026-10-01', held: true }])).toEqual(record)
  })
})
