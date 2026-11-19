import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from './errors.ts'
import {
  addMilestone,
  checkIn,
  createGoal,
  endGoal,
  getGoal,
  goAgain,
  keepMilestone,
  listGoals,
  markGoalReached,
  pauseGoal,
  reopenGoal,
  resumeGoal,
  setWeeklyTarget,
  updateMilestone,
} from './realGoals.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ANSWER = { answered: true }

const fetchMock = vi.fn<typeof fetch>()

function sent(call = 0) {
  const [url, init] = fetchMock.mock.calls[call]
  return { url, method: init?.method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(ANSWER), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reads', () => {
  it('gets the goal list and one goal’s page', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ goals: [] }), { status: 200 }))

    expect(await listGoals()).toEqual([])
    expect(await getGoal('g1')).toEqual(ANSWER)
    expect([sent(0), sent(1)]).toEqual([
      { url: '/api/goals', method: 'GET', body: undefined },
      { url: '/api/goals/g1', method: 'GET', body: undefined },
    ])
  })

  it('reports a goal that isn’t there as not found', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 404 }))

    await expect(getGoal('gone')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('status changes', () => {
  it.each([
    ['pause', pauseGoal],
    ['resume', resumeGoal],
    ['end', endGoal],
    ['mark-reached', markGoalReached],
    ['reopen', reopenGoal],
    ['go-again', goAgain],
  ])('posts %s with no body, returning the goal', async (route, change) => {
    expect(await change('g1')).toEqual(ANSWER)
    expect(sent()).toEqual({ url: `/api/goals/g1/${route}`, method: 'POST', body: undefined })
  })
})

describe('writes', () => {
  it('creates a goal at an id made on the device', async () => {
    const goal = { label: 'Be strong', measurableLine: 'Bench 175', type: 'building' as const }

    expect(await createGoal(goal)).toEqual(ANSWER)
    const { url, method, body } = sent()
    expect(method).toBe('PUT')
    expect(String(url).replace('/api/goals/', '')).toMatch(UUID_V4)
    expect(body).toEqual(goal)
  })

  it('puts the weekly target, returning the goal', async () => {
    const target = { kind: 'count' as const, sessions: 4, amount: null, unit: 'lifting sessions' }

    expect(await setWeeklyTarget('g1', target)).toEqual(ANSWER)
    expect(sent()).toEqual({ url: '/api/goals/g1/weekly-target', method: 'PUT', body: target })
  })

  it('adds a milestone at an id made on the device, with no date as null, returning the page', async () => {
    expect(await addMilestone('g1', { measurableLine: 'Bench 172' })).toEqual(ANSWER)
    const { url, method, body } = sent()
    expect(method).toBe('PUT')
    expect(String(url).replace('/api/milestones/', '')).toMatch(UUID_V4)
    expect(body).toEqual({ goalId: 'g1', measurableLine: 'Bench 172', targetDate: null })
  })

  it('edits a milestone whole, and keeps one with no body', async () => {
    await updateMilestone('m1', { measurableLine: 'Bench 153', targetDate: '2026-11-27' })
    await keepMilestone('m1')

    expect([sent(0), sent(1)]).toEqual([
      { url: '/api/milestones/m1', method: 'PATCH', body: { measurableLine: 'Bench 153', targetDate: '2026-11-27' } },
      { url: '/api/milestones/m1/keep', method: 'POST', body: undefined },
    ])
  })

  it('checks in at an id made on the device, a blank result as null', async () => {
    await checkIn('g1', 'm1', 'hit', ' Bench 155 ')
    await checkIn('g1', null, 'notYet', '  ')

    expect(String(sent(0).url).replace('/api/check-ins/', '')).toMatch(UUID_V4)
    expect(sent(0)).toMatchObject({ method: 'PUT', body: { goalId: 'g1', milestoneId: 'm1', outcome: 'hit', result: 'Bench 155' } })
    expect(sent(1).body).toEqual({ goalId: 'g1', milestoneId: null, outcome: 'notYet', result: null })
    expect(sent(1).url).not.toBe(sent(0).url)
  })
})
