import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from './errors.ts'
import {
  addTask,
  answerStillMatters,
  checkOffTask,
  getWeek,
  moveTaskToBank,
  placeTask,
  swapTasks,
  uncheckTask,
  wrapUpWeek,
} from './realPlan.ts'

const ANSWER = { answered: true }
const fetchMock = vi.fn<typeof fetch>()

function sent(call = 0) {
  const [url, init] = fetchMock.mock.calls[call]
  return { url, method: init?.method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
}

function answerWith(body: unknown, status = 200) {
  fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 18, 9, 0)) // Wednesday 18 Nov 2026
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(ANSWER), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getWeek', () => {
  it('reads the week asked for', async () => {
    await getWeek('2026-11-23')

    expect(sent()).toEqual({ url: '/api/weeks/2026-11-23', method: 'GET', body: undefined })
  })

  it("reads the phone's week when no week is asked for", async () => {
    answerWith({ week: '2026-11-16', isCurrent: true })

    expect(await getWeek()).toEqual({ week: '2026-11-16', isCurrent: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sent().url).toBe('/api/weeks/2026-11-16')
  })

  it("reads the week after once the phone's week was wrapped up early", async () => {
    answerWith({ week: '2026-11-16', isCurrent: false })
    answerWith({ week: '2026-11-23', isCurrent: true })

    expect(await getWeek()).toEqual({ week: '2026-11-23', isCurrent: true })
    expect(sent(1).url).toBe('/api/weeks/2026-11-23')
  })

  it("reports a week that isn't there as not found", async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 404 }))

    await expect(getWeek('2026-12-07')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('addTask', () => {
  it('puts the task at an id made on the device, with what was typed', async () => {
    await addTask({ title: 'Call the vet', day: '2026-11-18', dueDate: '2026-11-20' })

    const { url, method, body } = sent()
    expect(method).toBe('PUT')
    expect(url).toMatch(/^\/api\/tasks\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(body).toEqual({ title: 'Call the vet', day: '2026-11-18', dueDate: '2026-11-20' })
  })
})

describe('what the person does to a task', () => {
  const checkOff = { completedAt: '2026-11-18T16:00:00.000Z', completedOn: '2026-11-18', valueLogged: null }

  it.each([
    ['check off', () => checkOffTask('t1', checkOff), 'POST', '/api/tasks/t1/check-off', checkOff],
    ['uncheck', () => uncheckTask('t1'), 'POST', '/api/tasks/t1/uncheck', undefined],
    ['back to the bank', () => moveTaskToBank('t1', '2026-11-16'), 'POST', '/api/tasks/t1/bank', { week: '2026-11-16' }],
    ['place on a day', () => placeTask('t1', '2026-11-16', '2026-11-19'), 'POST', '/api/tasks/t1/place', { week: '2026-11-16', day: '2026-11-19' }],
    [
      'swap',
      () => swapTasks('t1', { week: '2026-11-16', bankTaskId: 't2', day: '2026-11-18' }),
      'POST',
      '/api/tasks/t1/swap',
      { week: '2026-11-16', bankTaskId: 't2', day: '2026-11-18' },
    ],
    ['still matters: keep', () => answerStillMatters('t1', { answer: 'keep' }), 'POST', '/api/tasks/t1/still-matters', { answer: 'keep' }],
    [
      'still matters: a day',
      () => answerStillMatters('t1', { answer: 'schedule', week: '2026-11-16', day: '2026-11-20' }),
      'POST',
      '/api/tasks/t1/still-matters',
      { answer: 'schedule', week: '2026-11-16', day: '2026-11-20' },
    ],
    ['wrap up', () => wrapUpWeek('2026-11-16'), 'POST', '/api/weeks/2026-11-16/wrap-up', undefined],
  ] as const)('%s', async (_name, send, method, url, body) => {
    expect(await send()).toEqual(ANSWER)
    expect(sent()).toEqual({ url, method, body })
  })
})
