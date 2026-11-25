import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from './errors.ts'
import type { RecurringItem, Task } from './types.ts'
import { aTask } from '../test/tasks.ts'
import {
  addTask,
  answerStillMatters,
  checkOffTask,
  createRecurringItem,
  turnOffRecurringItem,
  turnOnRecurringItem,
  updateRecurringItem,
  getUpcoming,
  getUpkeep,
  getWeek,
  listRecurringItems,
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

  it('puts it at the id it is given, so a queued add sent twice is one task', async () => {
    await addTask({ title: 'Call the vet' }, 'task-1')

    expect(sent().url).toBe('/api/tasks/task-1')
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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function item(id: string, fields: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id,
    name: id,
    aspirationId: null,
    fromGoalId: null,
    schedule: { kind: 'weekly', weekday: 'tuesday' },
    startsOn: '2026-11-16',
    active: true,
    createdAt: '2026-11-16T09:00:00Z',
    ...fields,
  }
}

describe('recurring items', () => {
  it('lists every item', async () => {
    answerWith({ recurringItems: [item('trash')] })

    expect(await listRecurringItems()).toEqual([item('trash')])
    expect(sent()).toEqual({ url: '/api/recurring-items', method: 'GET', body: undefined })
  })

  it('creates one at an id made on the device, with what was chosen', async () => {
    const chosen = { name: 'Water the plants', aspirationId: null, schedule: { kind: 'weekly', weekday: 'thursday' }, startsOn: '2026-11-18' } as const

    await createRecurringItem(chosen)

    const { url, method, body } = sent()
    expect(method).toBe('PUT')
    expect(String(url).replace('/api/recurring-items/', '')).toMatch(UUID_V4)
    expect(body).toEqual(chosen)
  })

  it('sends an edit whole, to the item', async () => {
    const edit = { name: 'Trash and recycling', aspirationId: null, schedule: { kind: 'weekly', weekday: 'wednesday' }, startsOn: '2026-11-16' } as const
    answerWith(item('trash', edit))

    expect((await updateRecurringItem('trash', edit)).name).toBe('Trash and recycling')
    expect(sent()).toEqual({ url: '/api/recurring-items/trash', method: 'PATCH', body: edit })
  })

  it('turns one off and on', async () => {
    await turnOffRecurringItem('trash')
    await turnOnRecurringItem('trash')

    expect(sent(0)).toEqual({ url: '/api/recurring-items/trash/turn-off', method: 'POST', body: undefined })
    expect(sent(1)).toEqual({ url: '/api/recurring-items/trash/turn-on', method: 'POST', body: undefined })
  })
})

describe('getUpcoming', () => {
  it('reads the tasks waiting for their week', async () => {
    answerWith({ tasks: [aTask('passport', { week: null })] })

    expect((await getUpcoming()).map((task) => task.id)).toEqual(['passport'])
    expect(sent().url).toBe('/api/tasks/upcoming')
  })
})

describe('getUpkeep', () => {
  // Answers like the API would for each read Keep life running makes.
  function serve({ nextWeekOpen, next = [] }: { nextWeekOpen: boolean; next?: Task[] }) {
    const thisWeek = [
      aTask('groceries', { week: '2026-11-16', plannedDay: '2026-11-19' }),
      aTask('lift', { week: '2026-11-16', goalId: 'strong' }),
      aTask('trash', { week: '2026-11-16', recurringItemId: 'trash' }),
      aTask('ballot', { week: '2026-11-16', state: 'done' }),
    ]
    fetchMock.mockImplementation(async (url) => {
      const path = String(url)
      const body =
        path === '/api/recurring-items'
          ? { recurringItems: [item('trash'), item('rent', { active: false }), item('stretch', { aspirationId: 'fit' })] }
          : path === '/api/tasks/upcoming'
            ? { tasks: [aTask('passport', { week: null, dueDate: '2027-01-10' })] }
            : path === '/api/weeks/2026-11-16'
              ? { week: '2026-11-16', isCurrent: true, nextWeekOpen, tasks: thisWeek }
              : path === '/api/weeks/2026-11-23'
                ? { week: '2026-11-23', isCurrent: false, nextWeekOpen, tasks: next }
                : undefined
      if (!body) throw new Error(`Unexpected ${path}`)
      return new Response(JSON.stringify(body), { status: 200 })
    })
  }

  it('keeps the items with no aspiration, on and off, and the open loose tasks', async () => {
    serve({ nextWeekOpen: false })

    const upkeep = await getUpkeep()

    expect(upkeep.recurringItems.map((found) => found.id)).toEqual(['trash', 'rent'])
    expect(upkeep.tasks.map((task) => task.id)).toEqual(['groceries', 'passport'])
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('/api/weeks/2026-11-23')
  })

  it('reads next week too once it is open', async () => {
    serve({ nextWeekOpen: true, next: [aTask('insurance', { week: '2026-11-23' })] })

    expect((await getUpkeep()).tasks.map((task) => task.id)).toEqual(['groceries', 'insurance', 'passport'])
  })
})
