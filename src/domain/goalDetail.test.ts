import { describe, expect, it } from 'vitest'
import type { Aspiration, Goal, GoalDetail, Milestone, MilestoneStatus, WeeklyTarget } from '../api/types.ts'
import {
  achievementLine,
  backLabel,
  canCondense,
  condenseTimeline,
  goalPage,
  hitLine,
  parsedMilestone,
  parsedReopen,
  parsedTarget,
  pushedDates,
  reopenDraft,
  showAllLabel,
  shownRowKey,
  targetDraft,
  weekLabel,
  withCheckIn,
  withMilestone,
  withReopened,
  withTarget,
  type CurrentPage,
  type EndedPage,
  type MilestoneRow,
  type ReachedPage,
} from './goalDetail.ts'

// Wednesday 11 Nov 2026.
const TODAY = '2026-11-11'

function goal(extra: Partial<Goal> = {}): Goal {
  return {
    id: 'strong',
    label: 'Be strong',
    measurableLine: 'Bench 175, squat 350, deadlift 400',
    type: 'building',
    baseline: 'Bench 145, squat 275, deadlift 315',
    status: 'active',
    startDate: '2026-10-05',
    aspirationId: 'fit',
    ...extra,
  }
}

const BE_FIT: Aspiration = { id: 'fit', name: 'Be fit', priority: 1, status: 'active', createdAt: '2026-10-01T09:00:00Z' }

function milestone(id: string, status: MilestoneStatus, extra: Partial<Milestone> = {}): Milestone {
  return { id, goalId: 'strong', measurableLine: `Line ${id}`, status, ...extra }
}

const TARGET: WeeklyTarget = { id: 'wt', goalId: 'strong', amount: 3, unit: 'lifting sessions', effectiveFrom: '2026-10-05' }

function detail(extra: Partial<GoalDetail> = {}): GoalDetail {
  return {
    goal: goal(),
    aspiration: BE_FIT,
    milestones: [
      milestone('m1', 'hit', { result: 'Bench 150, squat 290, deadlift 330', targetDate: '2026-11-02', checkedInOn: '2026-11-02' }),
      milestone('m2', 'upcoming', { targetDate: '2026-11-30' }),
      milestone('m3', 'upcoming'),
    ],
    weeklyTarget: TARGET,
    ...extra,
  }
}

function current(input: GoalDetail): CurrentPage {
  const page = goalPage(input, TODAY)
  if (page.kind !== 'current') throw new Error(`expected a current page, got ${page.kind}`)
  return page
}

function milestoneRows(page: CurrentPage | ReachedPage | EndedPage): MilestoneRow[] {
  return page.timeline.rows.filter((row): row is MilestoneRow => row.kind === 'milestone')
}

describe('weekLabel', () => {
  it('counts the week the goal starts in as Wk 1', () => {
    expect(weekLabel('2026-10-05', '2026-10-05')).toBe('Wk 1 · Oct 5')
    expect(weekLabel('2026-10-05', '2026-10-11')).toBe('Wk 1 · Oct 11')
    expect(weekLabel('2026-10-05', '2026-11-30')).toBe('Wk 9 · Nov 30')
    expect(weekLabel('2026-10-05', '2026-12-07')).toBe('Wk 10 · Dec 7')
  })

  it('counts by Monday-start weeks when the goal starts mid-week', () => {
    expect(weekLabel('2026-10-08', '2026-10-12')).toBe('Wk 2 · Oct 12')
  })

  it('says No date without one', () => {
    expect(weekLabel('2026-10-05', undefined)).toBe('No date')
  })
})

describe('goalPage header', () => {
  it('has the label, measurable line, type and aspiration link', () => {
    expect(current(detail()).header).toEqual({
      goalId: 'strong',
      label: 'Be strong',
      measurableLine: 'Bench 175, squat 350, deadlift 400',
      kindLine: 'Building',
      aspiration: { aspirationId: 'fit', name: 'Be fit' },
    })
  })

  it('names each type, marks a paused goal and leaves out a missing aspiration', () => {
    const header = current(detail({ goal: goal({ type: 'quitting', status: 'paused' }), aspiration: undefined })).header

    expect(header.kindLine).toBe('Quitting · Paused')
    expect(header.aspiration).toBeUndefined()
    expect(current(detail({ goal: goal({ type: 'oneOff' }) })).header.kindLine).toBe('One-off')
  })
})

describe('goalPage started and latest', () => {
  it('shows the baseline and the most recent result with its date', () => {
    expect(current(detail()).started).toEqual({
      startedAt: 'Started at: Bench 145, squat 275, deadlift 315',
      latest: 'Latest: Bench 150, squat 290, deadlift 330 · Nov 2',
    })
  })

  it('takes the latest check-in, not-yet results included', () => {
    const page = current(
      detail({
        milestones: [
          milestone('m1', 'hit', { result: 'First', checkedInOn: '2026-11-02' }),
          milestone('m2', 'notYet', { result: 'Second', checkedInOn: '2026-11-08' }),
        ],
      }),
    )

    expect(page.started?.latest).toBe('Latest: Second · Nov 8')
  })

  it('leaves out Latest with no results, and the section with no baseline', () => {
    expect(current(detail({ milestones: [] })).started).toEqual({ startedAt: 'Started at: Bench 145, squat 275, deadlift 315' })
    expect(current(detail({ goal: goal({ baseline: undefined }) })).started).toBeUndefined()
  })
})

describe('goalPage timeline', () => {
  it('runs from Start through each milestone to the Goal', () => {
    const { timeline } = current(detail())

    expect(timeline.heading).toBe('Milestones')
    expect(timeline.count).toBe('1 of 4 hit')
    expect(timeline.rows.map((row) => row.kind)).toEqual(['start', 'milestone', 'milestone', 'milestone', 'goal'])
    expect(timeline.rows[0]).toEqual({ kind: 'start', when: 'Oct 5', baseline: 'Bench 145, squat 275, deadlift 315' })
    expect(timeline.rows.at(-1)).toEqual({
      kind: 'goal',
      measurableLine: 'Bench 175, squat 350, deadlift 400',
      detail: 'Goal',
      status: 'upcoming',
      next: false,
      checkable: false,
    })
  })

  it('words each status: hit and not yet with their results, the goal Reached', () => {
    const rows = milestoneRows(
      current(detail({ milestones: [milestone('m1', 'hit', { result: 'Bench 150' }), milestone('m2', 'hit'), milestone('m3', 'notYet', { result: 'Bench 152' }), milestone('m4', 'upcoming')] })),
    )
    const reached = goalPage(detail({ goal: goal({ status: 'reached', endedAt: '2026-11-10', deadline: '2027-03-01' }) }), TODAY)

    expect(rows.map((row) => row.statusLine)).toEqual(['Hit · Bench 150', 'Hit', 'Not yet · Bench 152', undefined])
    expect(reached.timeline.rows.at(-1)).toMatchObject({ detail: 'Goal · Wk 22 · Mar 1', statusLine: 'Reached' })
  })

  it('gives each milestone its line, when, status and result', () => {
    const [first, second, third] = milestoneRows(current(detail()))

    expect(first).toMatchObject({ milestoneId: 'm1', measurableLine: 'Line m1', when: 'Wk 5 · Nov 2', status: 'hit', result: 'Bench 150, squat 290, deadlift 330' })
    expect(second).toMatchObject({ when: 'Wk 9 · Nov 30', status: 'upcoming' })
    expect(third).toMatchObject({ when: 'No date', status: 'upcoming' })
  })

  it('marks the first milestone that is not hit as Next, and only it can be checked in', () => {
    const rows = milestoneRows(current(detail()))

    expect(rows.map((row) => row.next)).toEqual([false, true, false])
    expect(rows.map((row) => row.checkable)).toEqual([false, true, false])
  })

  it('keeps a not-yet milestone as Next', () => {
    const rows = milestoneRows(
      current(detail({ milestones: [milestone('m1', 'hit'), milestone('m2', 'notYet', { result: 'Close' }), milestone('m3', 'upcoming')] })),
    )

    expect(rows.map((row) => row.next)).toEqual([false, true, false])
    expect(rows[1]).toMatchObject({ status: 'notYet', result: 'Close' })
  })

  it('makes the Goal row Next once every milestone is hit, and with none', () => {
    const allHit = current(detail({ milestones: [milestone('m1', 'hit')] }))
    const none = current(detail({ milestones: [] }))

    expect(allHit.timeline.rows.at(-1)).toMatchObject({ kind: 'goal', next: true, checkable: true })
    expect(none.timeline.rows.map((row) => row.kind)).toEqual(['start', 'goal'])
    expect(none.timeline.count).toBe('0 of 1 hit')
  })

  it('gives the Goal row its deadline', () => {
    const { timeline } = current(detail({ goal: goal({ deadline: '2027-03-01' }) }))

    expect(timeline.rows.at(-1)).toMatchObject({ detail: 'Goal · Wk 22 · Mar 1' })
    expect(current(detail({ goal: goal({ deadline: '2027-03-01' }) })).dateRange).toEqual({ min: '2026-10-05', max: '2027-03-01' })
    expect(current(detail()).dateRange).toEqual({ min: '2026-10-05' })
  })

  it('calls them Steps on a one-off goal, and every step not done can be checked in', () => {
    const page = current(
      detail({
        goal: goal({ type: 'oneOff' }),
        milestones: [milestone('s1', 'hit'), milestone('s2', 'upcoming'), milestone('s3', 'notYet'), milestone('s4', 'upcoming')],
      }),
    )

    expect(page.timeline.heading).toBe('Steps')
    expect(page.timeline.count).toBe('1 of 5 done')
    expect(milestoneRows(page).map((row) => row.checkable)).toEqual([false, true, true, true])
    expect(milestoneRows(page).map((row) => row.next)).toEqual([false, true, false, false])
  })

  it('lets a paused goal be checked in, but not a reached or ended one', () => {
    expect(milestoneRows(current(detail({ goal: goal({ status: 'paused' }) })))[1].checkable).toBe(true)
    for (const status of ['reached', 'ended'] as const) {
      const page = goalPage(detail({ goal: goal({ status, endedAt: '2026-11-10' }) }), TODAY)
      expect(page.timeline.rows.some((row) => row.kind !== 'start' && row.checkable)).toBe(false)
      expect(page.timeline.rows.some((row) => row.kind !== 'start' && row.next)).toBe(false)
    }
  })

  it('counts the goal itself once it is reached', () => {
    const page = goalPage(detail({ goal: goal({ status: 'reached', endedAt: '2026-11-10' }) }), TODAY)

    expect(page.timeline.count).toBe('2 of 4 hit')
    expect(page.timeline.rows.at(-1)).toMatchObject({ kind: 'goal', status: 'hit' })
  })
})

describe('goalPage target', () => {
  it('shows a building goal’s target, or invites setting one', () => {
    expect(current(detail()).target).toEqual({ kind: 'weekly', line: '3 lifting sessions', action: 'Edit' })
    expect(current(detail({ weeklyTarget: undefined })).target).toEqual({ kind: 'weekly', line: 'No weekly target yet', action: 'Set' })
  })

  it('shows a one-off goal’s deadline, if any, and when a quitting goal started', () => {
    expect(current(detail({ goal: goal({ type: 'oneOff', deadline: '2026-12-04' }) })).target).toEqual({ kind: 'note', line: 'Deadline: Dec 4' })
    expect(current(detail({ goal: goal({ type: 'oneOff' }) })).target).toBeUndefined()
    expect(current(detail({ goal: goal({ type: 'quitting' }) })).target).toEqual({ kind: 'note', line: 'Since Oct 5' })
  })
})

describe('goalPage next check-in', () => {
  it('names Next and when it is due', () => {
    expect(current(detail()).nextCheckIn).toEqual({ milestoneId: 'm2', measurableLine: 'Line m2', when: 'Wk 9 · Nov 30' })
  })

  it('says whenever you choose without a date, with no change once the date has passed', () => {
    const undated = current(detail({ milestones: [milestone('m1', 'upcoming')] }))
    const passed = current(detail({ milestones: [milestone('m1', 'notYet', { targetDate: '2026-11-08' })] }))

    expect(undated.nextCheckIn.when).toBe('Whenever you choose')
    expect(passed.nextCheckIn.when).toBe('Wk 5 · Nov 8')
  })

  it('points at the goal once every milestone is hit', () => {
    expect(current(detail({ milestones: [], goal: goal({ deadline: '2027-03-01' }) })).nextCheckIn).toEqual({
      measurableLine: 'Bench 175, squat 350, deadlift 400',
      when: 'Mar 1',
    })
    expect(current(detail({ milestones: [] })).nextCheckIn.when).toBe('Whenever you choose')
  })
})

describe('goalPage not-yet card', () => {
  it('leads with the baseline, then the result, for the first not-yet milestone', () => {
    const page = current(
      detail({ milestones: [milestone('m1', 'notYet', { result: 'Bench 150, squat 295, deadlift 340', targetDate: '2026-11-08' })] }),
    )

    expect(page.notYet).toEqual({
      milestoneId: 'm1',
      measurableLine: 'Line m1',
      targetDate: '2026-11-08',
      progress: 'You started at bench 145, squat 275, deadlift 315. Now: bench 150, squat 295, deadlift 340.',
    })
  })

  it('leaves out an empty part, and is absent with nothing not yet', () => {
    const noResult = current(detail({ milestones: [milestone('m1', 'notYet')] }))
    const noBaseline = current(detail({ goal: goal({ baseline: undefined }), milestones: [milestone('m1', 'notYet', { result: 'Bench 150' })] }))
    const neither = current(detail({ goal: goal({ baseline: undefined }), milestones: [milestone('m1', 'notYet')] }))

    expect(noResult.notYet?.progress).toBe('You started at bench 145, squat 275, deadlift 315.')
    expect(noBaseline.notYet?.progress).toBe('Now: bench 150.')
    expect(neither.notYet?.progress).toBeUndefined()
    expect(current(detail()).notYet).toBeUndefined()
  })
})

describe('goalPage reached and ended', () => {
  it('reads Reached with the date and what’s next for its aspiration', () => {
    const page = goalPage(detail({ goal: goal({ status: 'reached', endedAt: '2026-11-10' }) }), TODAY)

    expect(page).toMatchObject({ kind: 'reached', reachedLine: 'Reached Nov 10', whatsNext: 'What’s next for Be fit?' })
    const lastYear = goalPage(detail({ goal: goal({ status: 'reached', endedAt: '2025-09-15' }), aspiration: undefined }), TODAY)
    expect(lastYear).toMatchObject({ reachedLine: 'Reached Sep 15, 2025' })
    expect(lastYear).not.toHaveProperty('whatsNext')
  })

  it('reads Not yet with what was achieved when ended', () => {
    const page = goalPage(detail({ goal: goal({ status: 'ended', endedAt: '2026-11-10' }) }), TODAY)

    expect(page).toMatchObject({ kind: 'ended', achievement: '1 of 4 milestones hit' })
    expect((page as EndedPage).started?.startedAt).toBe('Started at: Bench 145, squat 275, deadlift 315')
  })

  it('fails loudly on a reached goal with no end date', () => {
    expect(() => goalPage(detail({ goal: goal({ status: 'reached' }) }), TODAY)).toThrow()
  })
})

describe('achievementLine', () => {
  it('counts milestones hit, or steps done', () => {
    expect(achievementLine(detail())).toBe('1 of 4 milestones hit')
    expect(achievementLine(detail({ goal: goal({ type: 'oneOff' }) }))).toBe('1 of 4 steps done')
  })
})

describe('pushedDates', () => {
  const later = [
    milestone('m1', 'hit', { targetDate: '2026-11-02' }),
    milestone('m2', 'notYet', { targetDate: '2026-11-08' }),
    milestone('m3', 'upcoming', { targetDate: '2026-11-30' }),
    milestone('m4', 'upcoming'),
    milestone('m5', 'upcoming', { targetDate: '2026-12-28' }),
  ]

  function datesOf(milestones: Milestone[]) {
    return milestones.map((row) => row.targetDate)
  }

  it('moves the later dated milestones by the same number of days', () => {
    expect(datesOf(pushedDates(goal(), later, 'm2', '2026-11-29'))).toEqual([
      '2026-11-02',
      '2026-11-29',
      '2026-12-21',
      undefined,
      '2027-01-18',
    ])
  })

  it('never goes past the deadline', () => {
    expect(datesOf(pushedDates(goal({ deadline: '2027-01-04' }), later, 'm2', '2026-11-29'))).toEqual([
      '2026-11-02',
      '2026-11-29',
      '2026-12-21',
      undefined,
      '2027-01-04',
    ])
    expect(pushedDates(goal({ deadline: '2026-11-20' }), later, 'm2', '2026-12-01')[1].targetDate).toBe('2026-11-20')
  })

  it('pulls nothing in when moved earlier', () => {
    expect(datesOf(pushedDates(goal(), later, 'm3', '2026-11-20'))).toEqual([
      '2026-11-02',
      '2026-11-08',
      '2026-11-20',
      undefined,
      '2026-12-28',
    ])
  })

  it('moves nothing else when the milestone had no date', () => {
    expect(datesOf(pushedDates(goal(), later, 'm4', '2026-12-14'))).toEqual([
      '2026-11-02',
      '2026-11-08',
      '2026-11-30',
      '2026-12-14',
      '2026-12-28',
    ])
  })

  it('moves only the step itself on a one-off goal', () => {
    expect(datesOf(pushedDates(goal({ type: 'oneOff' }), later, 'm2', '2026-11-29'))).toEqual([
      '2026-11-02',
      '2026-11-29',
      '2026-11-30',
      undefined,
      '2026-12-28',
    ])
  })

  it('leaves a later milestone that is already hit where it is', () => {
    const withLaterHit = [
      milestone('m1', 'notYet', { targetDate: '2026-11-08' }),
      milestone('m2', 'hit', { targetDate: '2026-11-15' }),
      milestone('m3', 'upcoming', { targetDate: '2026-11-30' }),
    ]

    expect(datesOf(pushedDates(goal(), withLaterHit, 'm1', '2026-11-22'))).toEqual(['2026-11-22', '2026-11-15', '2026-12-14'])
  })

  it('returns copies and leaves the input alone', () => {
    const before = structuredClone(later)
    pushedDates(goal(), later, 'm2', '2026-11-29')

    expect(later).toEqual(before)
  })
})

describe('condenseTimeline', () => {
  // What each shown row is: a milestone's id, 'start', 'goal', or a fold's label.
  function shape(input: GoalDetail): string[] {
    const page = goalPage(input, TODAY)
    return condenseTimeline(page.timeline).map((row) => {
      if (row.kind === 'fold') return `fold: ${row.label}`
      if (row.kind === 'milestone') return row.milestoneId
      return row.kind
    })
  }

  function strong(statuses: MilestoneStatus[], dates: (string | undefined)[] = []): GoalDetail {
    return detail({
      milestones: statuses.map((status, index) => milestone(`m${index + 1}`, status, dates[index] ? { targetDate: dates[index] } : {})),
    })
  }

  it('shows every row with four milestones or fewer, and says so', () => {
    const input = strong(['hit', 'hit', 'upcoming', 'upcoming'])

    expect(canCondense(goalPage(input, TODAY).timeline)).toBe(false)
    expect(shape(input)).toEqual(['start', 'm1', 'm2', 'm3', 'm4', 'goal'])
  })

  it('keeps the latest hit, the not-yet Next and the goal, as on Be strong', () => {
    const input = strong(['hit', 'notYet', 'upcoming', 'upcoming', 'upcoming'], [undefined, undefined, '2026-11-30'])

    expect(canCondense(goalPage(input, TODAY).timeline)).toBe(true)
    expect(shape(input)).toEqual(['start', 'm1', 'm2', 'fold: 3 more: Wk 9, No date, No date', 'goal'])
  })

  it('folds Start with the hit milestones before the latest one', () => {
    const input = strong(['hit', 'hit', 'hit', 'upcoming', 'upcoming', 'upcoming'], [undefined, undefined, undefined, undefined, '2027-01-25', '2027-02-22'])

    expect(shape(input)).toEqual(['fold: Start and 2 hit milestones', 'm3', 'm4', 'fold: 2 more: Wk 17, Wk 21', 'goal'])
  })

  it('says 1 hit milestone in the singular', () => {
    const input = strong(['hit', 'hit', 'upcoming', 'upcoming', 'upcoming'])

    expect(shape(input)[0]).toBe('fold: Start and 1 hit milestone')
  })

  it('never folds a not-yet step on a one-off goal', () => {
    const input = detail({
      goal: goal({ type: 'oneOff' }),
      milestones: [
        milestone('s1', 'upcoming'),
        milestone('s2', 'hit'),
        milestone('s3', 'upcoming'),
        milestone('s4', 'notYet'),
        milestone('s5', 'upcoming'),
        milestone('s6', 'upcoming'),
      ],
    })

    expect(shape(input)).toEqual(['start', 's1', 's2', 's3', 's4', 'fold: 2 more: No date, No date', 'goal'])
  })

  it('names done steps on a one-off goal', () => {
    const input = detail({
      goal: goal({ type: 'oneOff' }),
      milestones: ['hit', 'hit', 'hit', 'upcoming', 'upcoming'].map((status, index) => milestone(`s${index + 1}`, status as MilestoneStatus)),
    })

    expect(shape(input)[0]).toBe('fold: Start and 2 steps done')
  })

  it('keeps the last hit and the goal when all are hit', () => {
    const input = strong(['hit', 'hit', 'hit', 'hit', 'hit'])

    expect(shape(input)).toEqual(['fold: Start and 4 hit milestones', 'm5', 'goal'])
  })

  it('keeps Start, Next and the goal when none are hit', () => {
    const input = strong(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])

    expect(shape(input)).toEqual(['start', 'm1', 'fold: 4 more: No date, No date, No date, No date', 'goal'])
  })

  it('counts the rows each fold hides', () => {
    const input = strong(['hit', 'hit', 'hit', 'upcoming', 'upcoming', 'upcoming'])
    const folds = condenseTimeline(goalPage(input, TODAY).timeline).filter((row) => row.kind === 'fold')

    expect(folds.map((fold) => fold.hidden)).toEqual([3, 2])
  })

  it('gives each fold its own key, even when two read the same', () => {
    const input = detail({
      goal: goal({ type: 'oneOff' }),
      milestones: [
        milestone('s1', 'upcoming'),
        milestone('s2', 'upcoming'),
        milestone('s3', 'upcoming'),
        milestone('s4', 'notYet'),
        milestone('s5', 'upcoming'),
        milestone('s6', 'upcoming'),
      ],
    })
    const folds = condenseTimeline(goalPage(input, TODAY).timeline).filter((row) => row.kind === 'fold')

    expect(folds.map((fold) => fold.label)).toEqual(['2 more: No date, No date', '2 more: No date, No date'])
    expect(folds.map((fold) => fold.key)).toEqual(['fold-s2', 'fold-s5'])
  })
})

describe('shownRowKey', () => {
  it('keys a row by what it stands for', () => {
    const rows = condenseTimeline(goalPage(detail(), TODAY).timeline)

    expect(rows.map(shownRowKey)).toEqual(['start', 'm1', 'm2', 'm3', 'goal'])
  })
})

describe('backLabel', () => {
  it('names the tab, or the aspiration the goal was opened from', () => {
    expect(backLabel({ screen: 'aspirations' }, BE_FIT)).toBe('Aspirations')
    expect(backLabel({ screen: 'aspiration', aspirationId: 'fit' }, BE_FIT)).toBe('Be fit')
  })

  it('says nothing it can’t be sure of', () => {
    expect(backLabel({ screen: 'aspiration', aspirationId: 'gone' }, BE_FIT)).toBeUndefined()
    expect(backLabel({ screen: 'aspiration', aspirationId: 'fit' }, undefined)).toBeUndefined()
  })
})

describe('showAllLabel', () => {
  it('counts the milestones and the goal', () => {
    expect(showAllLabel(current(detail()).timeline)).toBe('Show all 4')
  })
})

describe('the target form', () => {
  it('starts from the target in force, or empty', () => {
    expect(targetDraft(detail())).toEqual({ amount: '3', unit: 'lifting sessions' })
    expect(targetDraft(detail({ weeklyTarget: undefined }))).toEqual({ amount: '', unit: '' })
  })

  it('takes a whole number of at least 1 and a unit, trimmed', () => {
    expect(parsedTarget({ amount: ' 4 ', unit: ' gym visits ' })).toEqual({ amount: 4, unit: 'gym visits' })
    for (const amount of ['0', '-1', '2.5', 'three', '']) {
      expect(parsedTarget({ amount, unit: 'runs' })).toBeUndefined()
    }
    expect(parsedTarget({ amount: '3', unit: '  ' })).toBeUndefined()
  })

  it('shows a new target at once, from this week', () => {
    const changed = withTarget(detail(), { amount: 4, unit: 'lifting sessions' }, TODAY)
    const first = withTarget(detail({ weeklyTarget: undefined }), { amount: 2, unit: 'clean meals' }, TODAY)

    expect(changed.weeklyTarget).toMatchObject({ goalId: 'strong', amount: 4, unit: 'lifting sessions', effectiveFrom: '2026-11-09' })
    expect(first.weeklyTarget).toMatchObject({ goalId: 'strong', amount: 2, unit: 'clean meals', effectiveFrom: '2026-11-09' })
    expect(current(changed).target).toEqual({ kind: 'weekly', line: '4 lifting sessions', action: 'Edit' })
  })
})

describe('the add milestone form', () => {
  it('takes a line and an optional date, no later than the deadline', () => {
    expect(parsedMilestone({ measurableLine: ' Bench 172 ', targetDate: '' }, goal())).toEqual({ measurableLine: 'Bench 172' })
    expect(parsedMilestone({ measurableLine: 'Bench 172', targetDate: '2027-01-04' }, goal())).toEqual({
      measurableLine: 'Bench 172',
      targetDate: '2027-01-04',
    })
    expect(parsedMilestone({ measurableLine: '  ', targetDate: '' }, goal())).toBeUndefined()
    expect(parsedMilestone({ measurableLine: 'Paint', targetDate: '2027-01-05' }, goal({ deadline: '2027-01-04' }))).toBeUndefined()
  })

  it('takes no date before the goal started', () => {
    expect(parsedMilestone({ measurableLine: 'Bench 140', targetDate: '2026-09-01' }, goal())).toBeUndefined()
    expect(parsedMilestone({ measurableLine: 'Bench 150', targetDate: '2026-10-05' }, goal())).toEqual({
      measurableLine: 'Bench 150',
      targetDate: '2026-10-05',
    })
  })

  it('adds the milestone last, at once', () => {
    const added = withMilestone(detail(), { id: 'pending', goalId: 'strong', measurableLine: 'Bench 172', status: 'upcoming' })

    expect(added.milestones.map((row) => row.id)).toEqual(['m1', 'm2', 'm3', 'pending'])
    expect(current(added).timeline.count).toBe('1 of 5 hit')
  })
})

describe('checking in, shown at once', () => {
  it('marks a milestone hit or not yet with today and the trimmed result', () => {
    const hit = withCheckIn(detail(), 'm2', 'hit', ' Bench 155 ', TODAY)
    const notYet = withCheckIn(detail(), 'm2', 'notYet', '  ', TODAY)

    expect(hit.milestones[1]).toMatchObject({ status: 'hit', result: 'Bench 155', checkedInOn: TODAY })
    expect(notYet.milestones[1]).toMatchObject({ status: 'notYet', checkedInOn: TODAY })
    expect(notYet.milestones[1]).not.toHaveProperty('result')
    expect(milestoneRows(current(hit)).find((row) => row.next)?.milestoneId).toBe('m3')
    expect(current(notYet).notYet?.milestoneId).toBe('m2')
  })

  it('says what was hit, or which step is done', () => {
    expect(hitLine(detail(), 'm2')).toBe('Milestone hit: Line m2')
    expect(hitLine(detail({ goal: goal({ type: 'oneOff' }) }), 'm2')).toBe('Step done: Line m2')
  })
})

describe('reopening a not-yet milestone, shown at once', () => {
  const notYetDetail = () =>
    detail({
      milestones: [
        milestone('m1', 'hit', { targetDate: '2026-11-02' }),
        milestone('m2', 'notYet', { targetDate: '2026-11-08', result: 'Bench 152' }),
        milestone('m3', 'upcoming', { targetDate: '2026-11-30' }),
      ],
    })

  it('keeps the date: back to upcoming, still Next, the card gone', () => {
    const kept = withReopened(notYetDetail(), 'm2', {})

    expect(kept.milestones.map((row) => [row.status, row.targetDate])).toEqual([
      ['hit', '2026-11-02'],
      ['upcoming', '2026-11-08'],
      ['upcoming', '2026-11-30'],
    ])
    expect(current(kept).notYet).toBeUndefined()
    expect(current(kept).nextCheckIn.milestoneId).toBe('m2')
  })

  it('moves the date and pushes the later ones out', () => {
    const moved = withReopened(notYetDetail(), 'm2', { targetDate: '2026-11-22' })

    expect(moved.milestones.map((row) => row.targetDate)).toEqual(['2026-11-02', '2026-11-22', '2026-12-14'])
  })

  it('adjusts the line, trimmed', () => {
    const adjusted = withReopened(notYetDetail(), 'm2', { measurableLine: ' Bench 153 ' })

    expect(adjusted.milestones[1]).toMatchObject({ measurableLine: 'Bench 153', status: 'upcoming' })
  })
})

describe('the move and adjust forms', () => {
  it('needs a date within the goal to move, and a line to adjust', () => {
    expect(parsedReopen('move', { measurableLine: 'Line', targetDate: '2026-11-22' }, goal())).toEqual({ targetDate: '2026-11-22' })
    expect(parsedReopen('move', { measurableLine: 'Line', targetDate: '' }, goal())).toBeUndefined()
    expect(parsedReopen('move', { measurableLine: 'Line', targetDate: '2026-09-01' }, goal())).toBeUndefined()
    expect(parsedReopen('adjust', { measurableLine: ' Bench 153 ', targetDate: '' }, goal())).toEqual({ measurableLine: 'Bench 153' })
    expect(parsedReopen('adjust', { measurableLine: 'Bench 153', targetDate: '2026-11-22' }, goal())).toEqual({
      measurableLine: 'Bench 153',
      targetDate: '2026-11-22',
    })
    expect(parsedReopen('adjust', { measurableLine: '  ', targetDate: '' }, goal())).toBeUndefined()
  })

  it('starts from the milestone as it is', () => {
    expect(reopenDraft(detail(), 'm2')).toEqual({ measurableLine: 'Line m2', targetDate: '2026-11-30' })
    expect(reopenDraft(detail(), 'm3')).toEqual({ measurableLine: 'Line m3', targetDate: '' })
  })
})

describe('goalPage actions', () => {
  it('offers Pause on an active goal and Resume on a paused one', () => {
    expect(current(detail()).pauseAction).toBe('Pause')
    expect(current(detail({ goal: goal({ status: 'paused' }) })).pauseAction).toBe('Resume')
  })

  it('gives the End sheet what was achieved', () => {
    expect(current(detail()).achievement).toBe('1 of 4 milestones hit')
  })
})
