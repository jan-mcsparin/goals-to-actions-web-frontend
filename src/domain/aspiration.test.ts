import { describe, expect, it } from 'vitest'
import type {
  Aspiration,
  AspirationDetail,
  Goal,
  Milestone,
  MilestoneStatus,
  RecurringItem,
  Task,
  WeeklyTarget,
} from '../api/types.ts'
import {
  aspirationPage,
  canSaveName,
  historyLine,
  priorityLine,
  withNameAndWhy,
  type ActivePage,
  type RetiredPage,
} from './aspiration.ts'

// Wednesday 11 Nov 2026.
const TODAY = '2026-11-11'
const WEEK_OF = '2026-11-09'

function aspiration(extra: Partial<Aspiration> = {}): Aspiration {
  return { id: 'fit', name: 'Be fit', priority: 1, status: 'active', createdAt: '2026-10-01T09:00:00Z', ...extra }
}

function goal(id: string, extra: Partial<Goal> = {}): Goal {
  return {
    id,
    label: id,
    measurableLine: `${id} measurable line`,
    type: 'building',
    status: 'active',
    startDate: '2026-10-05',
    aspirationId: 'fit',
    ...extra,
  }
}

function milestones(goalId: string, ...statuses: MilestoneStatus[]): Milestone[] {
  return statuses.map((status, index) => ({ id: `${goalId}-ms-${index}`, goalId, measurableLine: 'A step', status }))
}

function target(goalId: string, amount: number, unit = 'sessions'): WeeklyTarget {
  return { id: `wt-${goalId}`, goalId, amount, unit, effectiveFrom: '2026-10-05' }
}

function tasks(goalId: string, ...statuses: Task['status'][]): Task[] {
  return statuses.map((status, index) => ({
    id: `${goalId}-task-${index}`,
    title: 'A session',
    status,
    weekOf: WEEK_OF,
    goalId,
    rolloverCount: 0,
  }))
}

function recurring(name: string, active = true): RecurringItem {
  return { id: `rec-${name}`, name, repeatRule: 'Once a week', fixedDay: false, active, nextDue: '2026-11-15', aspirationId: 'fit' }
}

function detailOf(parts: Partial<AspirationDetail>): AspirationDetail {
  return {
    aspiration: aspiration(),
    goals: [],
    milestones: [],
    recurringItems: [],
    weeklyTargets: [],
    weekTasks: [],
    activeCount: 1,
    ...parts,
  }
}

function activePage(parts: Partial<AspirationDetail>): ActivePage {
  const page = aspirationPage(detailOf(parts), TODAY)
  if (page.kind !== 'active') throw new Error('Expected an active page')
  return page
}

function retiredPage(parts: Partial<AspirationDetail>): RetiredPage {
  const page = aspirationPage(
    detailOf({ aspiration: aspiration({ status: 'retired', priority: undefined, retiredAt: '2026-11-10T15:00:00Z' }), ...parts }),
    TODAY,
  )
  if (page.kind !== 'retired') throw new Error('Expected a retired page')
  return page
}

describe('aspirationPage, active', () => {
  it('shows the name and why', () => {
    const page = activePage({ aspiration: aspiration({ why: 'To keep skiing.' }) })

    expect(page).toMatchObject({ aspirationId: 'fit', name: 'Be fit', why: 'To keep skiing.' })
  })

  it("counts this week across its goals' targets, with days left through Sunday", () => {
    const page = activePage({
      goals: [goal('strong'), goal('endurance')],
      weeklyTargets: [target('strong', 3), target('endurance', 2)],
      weekTasks: [...tasks('strong', 'done', 'planned'), ...tasks('endurance', 'done')],
    })

    expect(page.week).toEqual({ done: 2, total: 5, label: '2 of 5 · 5 days left' })
  })

  it('says "1 day left" on Sunday', () => {
    const page = aspirationPage(
      detailOf({ goals: [goal('strong')], weeklyTargets: [target('strong', 3)] }),
      '2026-11-15',
    ) as ActivePage

    expect(page.week?.label).toBe('0 of 3 · 1 day left')
  })

  it('leaves This week out when no goal has a weekly target', () => {
    const page = activePage({ goals: [goal('look-good')] })

    expect(page.week).toBeUndefined()
  })

  it('gives each active goal a card, then the paused ones', () => {
    const page = activePage({
      goals: [goal('cook', { status: 'paused' }), goal('strong'), goal('5k', { status: 'reached' }), goal('endurance')],
    })

    expect(page.goals.map((card) => card.goalId)).toEqual(['strong', 'endurance', 'cook'])
    expect(page.activeGoalsLine).toBe('2 active')
  })

  it('shows milestone progress, counting the goal itself as the last milestone', () => {
    const page = activePage({
      goals: [goal('strong')],
      milestones: milestones('strong', 'hit', 'notYet', 'upcoming', 'upcoming', 'upcoming'),
    })

    expect(page.goals[0]).toMatchObject({
      label: 'strong',
      measurableLine: 'strong measurable line',
      progress: 'Milestone 1 of 6',
      reached: 1,
      total: 6,
    })
  })

  it('calls a one-off goal\'s milestones steps', () => {
    const page = activePage({ goals: [goal('garage', { type: 'oneOff' })], milestones: milestones('garage', 'hit', 'upcoming') })

    expect(page.goals[0].progress).toBe('Step 1 of 3')
  })

  it("gives a building goal its week against the target, in the target's unit", () => {
    const page = activePage({
      goals: [goal('strong')],
      weeklyTargets: [target('strong', 3, 'lifting sessions')],
      weekTasks: tasks('strong', 'done', 'planned', 'inBank'),
    })

    expect(page.goals[0].weekLine).toBe('This week: 1 of 3 lifting sessions')
  })

  it('says "No weekly target yet" for a building goal without one', () => {
    const page = activePage({ goals: [goal('look-good')] })

    expect(page.goals[0].weekLine).toBe('No weekly target yet')
  })

  it('gives one-off, quitting and paused goals no week line, and paused ones "Paused"', () => {
    const page = activePage({
      goals: [goal('garage', { type: 'oneOff' }), goal('smoking', { type: 'quitting' }), goal('cook', { status: 'paused' })],
      weeklyTargets: [target('cook', 5)],
    })

    expect(page.goals.map((card) => card.weekLine)).toEqual([undefined, undefined, undefined])
    expect(page.goals[2].progress).toBe('Paused')
  })

  it('lists its active recurring items with their repeat rule', () => {
    const page = activePage({ recurringItems: [recurring('Stretch'), recurring('Old', false)] })

    expect(page.recurring).toEqual([{ itemId: 'rec-Stretch', name: 'Stretch', repeatRule: 'Once a week', paused: false }])
  })

  it('lists past goals as Reached or Ended', () => {
    const page = activePage({ goals: [goal('5k', { status: 'reached' }), goal('swim', { status: 'ended' }), goal('strong')] })

    expect(page.pastGoals).toEqual([
      { goalId: '5k', label: '5k', outcome: 'Reached' },
      { goalId: 'swim', label: 'swim', outcome: 'Ended' },
    ])
  })

  it('places it in priority and says which moves apply', () => {
    expect(activePage({ aspiration: aspiration({ priority: 1 }), activeCount: 3 }).priority).toEqual({
      line: '1st of 3 aspirations',
      hint: 'Comes first when goals compete for time',
      canMoveUp: false,
      canMoveDown: true,
    })
    expect(activePage({ aspiration: aspiration({ priority: 2 }), activeCount: 3 }).priority).toMatchObject({
      hint: 'Higher ones come first when goals compete for time',
      canMoveUp: true,
      canMoveDown: true,
    })
    expect(activePage({ aspiration: aspiration({ priority: 3 }), activeCount: 3 }).priority).toMatchObject({
      canMoveUp: true,
      canMoveDown: false,
    })
    expect(activePage({ activeCount: 1 }).priority).toEqual({
      line: '1st of 1 aspiration',
      hint: 'Comes first when goals compete for time',
      canMoveUp: false,
      canMoveDown: false,
    })
  })

  it('refuses an active aspiration with no priority', () => {
    const detail = detailOf({ aspiration: aspiration({ priority: undefined }) })

    expect(() => aspirationPage(detail, TODAY)).toThrow('Active aspiration fit has no priority')
  })

  it('carries the history line for the Retire sheet', () => {
    const page = activePage({ goals: [goal('strong')] })

    expect(page.historyLine).toBe('Since October: 1 goal active.')
  })
})

describe('aspirationPage, retired', () => {
  it('shows the name, why and when it was retired', () => {
    const page = retiredPage({})

    expect(page).toMatchObject({ kind: 'retired', name: 'Be fit', retiredLine: 'Retired Nov 10' })
  })

  it('adds the year when it was retired in another year', () => {
    const page = retiredPage({
      aspiration: aspiration({ status: 'retired', priority: undefined, retiredAt: '2025-09-15T09:00:00Z' }),
    })

    expect(page.retiredLine).toBe('Retired Sep 15, 2025')
  })

  it('refuses a retired aspiration with no retired date', () => {
    const detail = detailOf({ aspiration: aspiration({ status: 'retired', priority: undefined }) })

    expect(() => aspirationPage(detail, TODAY)).toThrow('Retired aspiration fit has no retiredAt')
  })

  it('lists its past goals, its paused goals and the recurring items it paused', () => {
    const page = retiredPage({
      goals: [goal('5k', { status: 'reached' }), goal('strong', { status: 'paused' })],
      recurringItems: [recurring('Stretch', false)],
    })

    expect(page.pastGoals.map((row) => row.goalId)).toEqual(['5k'])
    expect(page.pausedGoals.map((card) => [card.goalId, card.progress])).toEqual([['strong', 'Paused']])
    expect(page.recurring).toEqual([{ itemId: 'rec-Stretch', name: 'Stretch', repeatRule: 'Once a week', paused: true }])
  })

  it('has no week, priority or history', () => {
    const page = retiredPage({ goals: [goal('strong', { status: 'paused' })], weeklyTargets: [target('strong', 3)] })

    expect(page).not.toHaveProperty('week')
    expect(page).not.toHaveProperty('priority')
    expect(page).not.toHaveProperty('historyLine')
  })
})

describe('withNameAndWhy', () => {
  it('trims both', () => {
    expect(withNameAndWhy(aspiration(), { name: ' Be fit for life ', why: ' To ski. ' })).toMatchObject({
      name: 'Be fit for life',
      why: 'To ski.',
    })
  })

  it('removes a blank why', () => {
    expect(withNameAndWhy(aspiration({ why: 'Old' }), { name: 'Be fit', why: '  ' })).not.toHaveProperty('why')
  })
})

describe('canSaveName', () => {
  it.each([
    ['Be fit', true],
    ['', false],
    ['   ', false],
  ])('"%s" → %s', (name, can) => {
    expect(canSaveName(name)).toBe(can)
  })
})

describe('priorityLine', () => {
  it.each([
    [1, 3, '1st of 3 aspirations'],
    [2, 3, '2nd of 3 aspirations'],
    [3, 3, '3rd of 3 aspirations'],
    [4, 12, '4th of 12 aspirations'],
    [11, 12, '11th of 12 aspirations'],
    [1, 1, '1st of 1 aspiration'],
  ])('puts %i of %i as "%s"', (position, count, line) => {
    expect(priorityLine(position, count)).toBe(line)
  })
})

describe('historyLine', () => {
  const since = aspiration({ createdAt: '2026-03-02T09:00:00Z' })

  it('counts goals reached, goals active and recurring items', () => {
    const line = historyLine(
      detailOf({
        aspiration: since,
        goals: [goal('5k', { status: 'reached' }), goal('a'), goal('b'), goal('c'), goal('cook', { status: 'paused' })],
        recurringItems: [recurring('Stretch'), recurring('Hockey')],
      }),
      TODAY,
    )

    expect(line).toBe('Since March: 1 goal reached, 3 goals active, 2 recurring items.')
  })

  it('leaves out the parts that are zero', () => {
    const line = historyLine(detailOf({ aspiration: since, recurringItems: [recurring('Stretch')] }), TODAY)

    expect(line).toBe('Since March: 1 recurring item.')
  })

  it('says only when it began when there is nothing to count', () => {
    expect(historyLine(detailOf({ aspiration: since }), TODAY)).toBe('Since March.')
  })

  it('adds the year when it began in another year', () => {
    const line = historyLine(detailOf({ aspiration: aspiration({ createdAt: '2025-03-02T09:00:00Z' }) }), TODAY)

    expect(line).toBe('Since March 2025.')
  })
})
