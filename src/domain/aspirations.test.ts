import { describe, expect, it } from 'vitest'
import type {
  Aspiration,
  AspirationsOverview,
  Goal,
  Milestone,
  MilestoneStatus,
  RecurringItem,
  Task,
  WeeklyTarget,
} from '../api/types.ts'
import {
  aspirationCards,
  aspirationsView,
  goalProgress,
  otherGoals,
  progressLabel,
  retiredAspirations,
  upkeepLine,
  weekCount,
} from './aspirations.ts'

const WEEK_OF = '2026-11-09'

function aspiration(id: string, priority: number, extra: Partial<Aspiration> = {}): Aspiration {
  return { id, name: id, priority, status: 'active', createdAt: '2026-10-01T09:00:00Z', ...extra }
}

function goal(id: string, extra: Partial<Goal> = {}): Goal {
  return {
    id,
    label: id,
    measurableLine: 'A measurable line',
    type: 'building',
    status: 'active',
    startDate: '2026-10-05',
    aspirationId: 'fit',
    ...extra,
  }
}

function milestones(goalId: string, ...statuses: MilestoneStatus[]): Milestone[] {
  return statuses.map((status, index) => ({
    id: `${goalId}-ms-${index}`,
    goalId,
    measurableLine: `Milestone ${index + 1}`,
    status,
  }))
}

function target(goalId: string, amount: number): WeeklyTarget {
  return { id: `wt-${goalId}`, goalId, amount, unit: 'sessions', effectiveFrom: '2026-10-05' }
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

function recurring(name: string, aspirationId?: string, active = true): RecurringItem {
  return { id: `rec-${name}`, name, repeatRule: 'Once a week', fixedDay: false, active, nextDue: '2026-11-15', aspirationId }
}

function overviewOf(parts: Partial<AspirationsOverview>): AspirationsOverview {
  return {
    aspirations: [aspiration('fit', 1)],
    goals: [],
    milestones: [],
    recurringItems: [],
    weeklyTargets: [],
    weekTasks: [],
    ...parts,
  }
}

describe('aspirationCards', () => {
  it('lists active aspirations in priority order, leaving retired ones out', () => {
    const cards = aspirationCards(
      overviewOf({
        aspirations: [
          aspiration('home', 2),
          aspiration('spanish', 3, { status: 'retired' }),
          aspiration('fit', 1, { name: 'Be fit', why: 'To keep skiing.' }),
        ],
      }),
    )

    expect(cards.map((card) => card.aspirationId)).toEqual(['fit', 'home'])
    expect(cards[0]).toMatchObject({ name: 'Be fit', why: 'To keep skiing.' })
    expect(cards[1].why).toBeUndefined()
  })

  it('groups goals under their aspiration, paused ones included and past ones left out', () => {
    const [fit, home] = aspirationCards(
      overviewOf({
        aspirations: [aspiration('fit', 1), aspiration('home', 2)],
        goals: [
          goal('strong'),
          goal('garage', { aspirationId: 'home' }),
          goal('mobility', { status: 'paused' }),
          goal('5k', { status: 'reached' }),
          goal('swim', { status: 'ended' }),
          goal('passport', { aspirationId: undefined }),
        ],
      }),
    )

    expect(fit.goals.map((row) => row.goalId)).toEqual(['strong', 'mobility'])
    expect(fit.goals[1].progress).toBe('Paused')
    expect(home.goals.map((row) => row.goalId)).toEqual(['garage'])
  })

  it('has no goal rows for an aspiration with no goals', () => {
    expect(aspirationCards(overviewOf({}))[0].goals).toEqual([])
  })

  it("names the aspiration's active recurring items on one line", () => {
    const [fit, home] = aspirationCards(
      overviewOf({
        aspirations: [aspiration('fit', 1), aspiration('home', 2)],
        recurringItems: [
          recurring('Stretch', 'fit'),
          recurring('Hockey', 'fit'),
          recurring('Yoga', 'fit', false),
          recurring('Pay rent'),
        ],
      }),
    )

    expect(fit.recurringLine).toBe('2 recurring: Stretch, Hockey')
    expect(home.recurringLine).toBe('No recurring items')
  })

  it('carries the week count only when a goal has a weekly target', () => {
    const [fit, home] = aspirationCards(
      overviewOf({
        aspirations: [aspiration('fit', 1), aspiration('home', 2)],
        goals: [goal('strong'), goal('garage', { aspirationId: 'home', type: 'oneOff' })],
        weeklyTargets: [target('strong', 3)],
        weekTasks: tasks('strong', 'done'),
      }),
    )

    expect(fit.week).toEqual({ done: 1, total: 3, label: '1 of 3 this week' })
    expect(home.week).toBeUndefined()
  })
})

describe('goalProgress', () => {
  it('says Milestone for building and quitting goals and Step for one-off goals', () => {
    expect(progressLabel('building', 1, 6)).toBe('Milestone 1 of 6')
    expect(progressLabel('quitting', 0, 1)).toBe('Milestone 0 of 1')
    expect(progressLabel('oneOff', 3, 6)).toBe('Step 3 of 6')
  })

  it('counts the goal itself as the final milestone', () => {
    const strong = goal('strong')
    const overview = { milestones: milestones('strong', 'hit', 'notYet', 'upcoming', 'upcoming', 'upcoming') }

    expect(goalProgress(strong, overview)).toBe('Milestone 1 of 6')
  })

  it('reads 0 of 1 with no milestones, and 1 of 1 once the goal is reached', () => {
    expect(goalProgress(goal('look-good'), { milestones: [] })).toBe('Milestone 0 of 1')
    expect(goalProgress(goal('garage', { type: 'oneOff' }), { milestones: [] })).toBe('Step 0 of 1')
    expect(goalProgress(goal('5k', { status: 'reached' }), { milestones: [] })).toBe('Milestone 1 of 1')
  })

  it('counts every milestone and the goal once a goal with milestones is reached', () => {
    const overview = { milestones: milestones('5k', 'hit', 'hit') }

    expect(goalProgress(goal('5k', { status: 'reached' }), overview)).toBe('Milestone 3 of 3')
  })

  it("only counts the goal's own milestones", () => {
    const overview = { milestones: [...milestones('strong', 'hit'), ...milestones('endurance', 'hit', 'hit')] }

    expect(goalProgress(goal('strong'), overview)).toBe('Milestone 1 of 2')
  })

  it('adds the deadline to a one-off goal, and to no other type', () => {
    const overview = { milestones: milestones('garage', 'hit', 'hit', 'hit', 'upcoming', 'upcoming') }

    expect(goalProgress(goal('garage', { type: 'oneOff', deadline: '2026-12-15' }), overview)).toBe(
      'Step 3 of 6 · by Dec 15',
    )
    expect(goalProgress(goal('garage', { type: 'oneOff' }), overview)).toBe('Step 3 of 6')
    expect(goalProgress(goal('garage', { deadline: '2026-12-15' }), overview)).toBe('Milestone 3 of 6')
  })

  it('reads Paused in place of the count', () => {
    const overview = { milestones: milestones('cook', 'hit') }

    expect(goalProgress(goal('cook', { status: 'paused' }), overview)).toBe('Paused')
  })
})

describe('weekCount', () => {
  it("sums the targets and the done tasks of the aspiration's goals", () => {
    const count = weekCount(
      'fit',
      overviewOf({
        goals: [goal('strong'), goal('endurance')],
        weeklyTargets: [target('strong', 3), target('endurance', 2)],
        weekTasks: [...tasks('strong', 'done', 'planned', 'inBank'), ...tasks('endurance', 'done', 'inBank')],
      }),
    )

    expect(count).toEqual({ done: 2, total: 5, label: '2 of 5 this week' })
  })

  it("caps each goal at its own target, so one goal can't hide another", () => {
    const count = weekCount(
      'fit',
      overviewOf({
        goals: [goal('strong'), goal('endurance')],
        weeklyTargets: [target('strong', 3), target('endurance', 2)],
        weekTasks: tasks('endurance', 'done', 'done', 'done', 'done'),
      }),
    )

    expect(count?.label).toBe('2 of 5 this week')
  })

  it('leaves out paused goals, goals with no target, other aspirations and goals that are not building goals', () => {
    const count = weekCount(
      'fit',
      overviewOf({
        goals: [
          goal('strong'),
          goal('look-good'),
          goal('mobility', { status: 'paused' }),
          goal('cook', { aspirationId: 'home' }),
          goal('race', { type: 'oneOff' }),
        ],
        weeklyTargets: [target('strong', 3), target('mobility', 4), target('cook', 5), target('race', 1)],
        weekTasks: [...tasks('strong', 'done'), ...tasks('mobility', 'done'), ...tasks('cook', 'done')],
      }),
    )

    expect(count?.label).toBe('1 of 3 this week')
  })

  it('gives nothing when no goal has a target', () => {
    expect(weekCount('fit', overviewOf({ goals: [goal('look-good')] }))).toBeUndefined()
  })
})

describe('otherGoals', () => {
  it('holds goals with no aspiration, with their reached and ended goals apart', () => {
    const other = otherGoals(
      overviewOf({
        goals: [
          goal('strong'),
          goal('passport', { aspirationId: undefined, type: 'oneOff', deadline: '2026-12-19' }),
          goal('reading', { aspirationId: undefined, status: 'paused' }),
          goal('taxes', { aspirationId: undefined, type: 'oneOff', status: 'reached' }),
          goal('blog', { aspirationId: undefined, status: 'ended' }),
        ],
      }),
    )

    expect(other?.goals).toEqual([
      { goalId: 'passport', label: 'passport', progress: 'Step 0 of 1 · by Dec 19' },
      { goalId: 'reading', label: 'reading', progress: 'Paused' },
    ])
    expect(other?.past.map((row) => row.goalId)).toEqual(['taxes', 'blog'])
    expect(other?.past[0].progress).toBe('Step 1 of 1')
  })

  it('takes in an active goal whose aspiration is retired, until it is brought back', () => {
    const spanish = aspiration('spanish', 0, { status: 'retired', priority: undefined, retiredAt: '2026-11-10' })
    const other = otherGoals(
      overviewOf({
        aspirations: [aspiration('fit', 1), spanish],
        goals: [
          goal('talk', { aspirationId: 'spanish' }),
          goal('read', { aspirationId: 'spanish', status: 'paused' }),
          goal('a2', { aspirationId: 'spanish', status: 'reached' }),
          goal('strong'),
        ],
      }),
    )

    expect(other?.goals.map((row) => row.goalId)).toEqual(['talk'])
    expect(other?.past).toEqual([])
  })

  it('is left out when every goal has an aspiration', () => {
    expect(otherGoals(overviewOf({ goals: [goal('strong')] }))).toBeUndefined()
  })

  it('is kept when only past goals have no aspiration', () => {
    const other = otherGoals(overviewOf({ goals: [goal('taxes', { aspirationId: undefined, status: 'reached' })] }))

    expect(other?.goals).toEqual([])
    expect(other?.past).toHaveLength(1)
  })
})

describe('upkeepLine', () => {
  it('counts the active recurring items with no aspiration', () => {
    const recurringItems = [recurring('Pay rent'), recurring('Laundry'), recurring('Old chore', undefined, false), recurring('Stretch', 'fit')]

    expect(upkeepLine({ recurringItems })).toBe('2 recurring')
  })

  it('says so when there are none', () => {
    expect(upkeepLine({ recurringItems: [recurring('Stretch', 'fit')] })).toBe('No recurring items')
  })
})

describe('retiredAspirations', () => {
  it('lists retired aspirations by name', () => {
    const aspirations = [aspiration('fit', 1), aspiration('spanish', 3, { name: 'Speak Spanish', status: 'retired' })]

    expect(retiredAspirations({ aspirations })).toEqual([{ aspirationId: 'spanish', name: 'Speak Spanish' }])
  })
})

describe('aspirationsView', () => {
  it('is empty only when there are no aspirations and no goals', () => {
    expect(aspirationsView(overviewOf({ aspirations: [] })).isEmpty).toBe(true)
    expect(aspirationsView(overviewOf({})).isEmpty).toBe(false)
    expect(
      aspirationsView(overviewOf({ aspirations: [], goals: [goal('passport', { aspirationId: undefined })] })).isEmpty,
    ).toBe(false)
  })

  it('puts the cards, other goals, upkeep line and retired list together', () => {
    const view = aspirationsView(
      overviewOf({
        aspirations: [aspiration('fit', 1), aspiration('spanish', 2, { status: 'retired' })],
        goals: [goal('strong'), goal('passport', { aspirationId: undefined })],
        recurringItems: [recurring('Pay rent')],
      }),
    )

    expect(view.cards.map((card) => card.aspirationId)).toEqual(['fit'])
    expect(view.otherGoals?.goals.map((row) => row.goalId)).toEqual(['passport'])
    expect(view.upkeepLine).toBe('1 recurring')
    expect(view.retired.map((retired) => retired.aspirationId)).toEqual(['spanish'])
  })
})
