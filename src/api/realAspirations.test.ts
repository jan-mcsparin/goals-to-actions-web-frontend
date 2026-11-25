import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from './errors.ts'
import {
  addAspiration,
  bringBackAspiration,
  deleteAspiration,
  getAspiration,
  getAspirations,
  getChoices,
  moveAspiration,
  retireAspiration,
  updateAspiration,
} from './realAspirations.ts'
import { GOAL_DEFAULTS, listed, weekGoal } from '../test/goals.ts'
import type { Aspiration, Goal, ListedGoal, RecurringItem } from './types.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function aspiration(id: string, position: number | null, extra: Partial<Aspiration> = {}): Aspiration {
  return {
    id,
    name: id,
    why: null,
    position,
    status: position === null ? 'retired' : 'active',
    createdAt: '2026-10-01T09:00:00Z',
    retiredOn: position === null ? '2026-09-15' : null,
    ...extra,
  }
}

const FIT = aspiration('fit', 1)
const HOME = aspiration('home', 2)
const READ = aspiration('read', 3)
const SPANISH = aspiration('spanish', null)

const fetchMock = vi.fn<typeof fetch>()

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function goal(id: string, aspirationId: string | null): Goal {
  return { ...GOAL_DEFAULTS, id, label: id, measurableLine: '-', type: 'building', status: 'active', startDate: '2026-10-05', aspirationId }
}

const [STRONG, CLEAN_HOUSE, READING] = listed([goal('strong', 'fit'), goal('clean-house', 'home'), goal('reading', null)])

function item(id: string, aspirationId: string | null, active = true): RecurringItem {
  return {
    id,
    name: id,
    aspirationId,
    fromGoalId: null,
    schedule: { kind: 'flexible', times: 3, period: 'week' },
    startsOn: '2026-10-05',
    active,
    createdAt: '2026-10-05T09:00:00Z',
  }
}

const STRETCH = item('stretch', 'fit')
const OLD_RUNS = item('old-runs', 'fit', false)
const TRASH = item('trash', null)

// The current week's bars: one goal under fit, one under home.
const WEEK_GOALS = [weekGoal('strong', 'fit', 1, 3), weekGoal('clean-house', 'home', 0, 2)]

// Answers like the API would, from the aspirations, goals and recurring items it keeps.
function serve(aspirations: Aspiration[], goals: ListedGoal[] = [], recurringItems: RecurringItem[] = []) {
  let rows = structuredClone(aspirations)
  fetchMock.mockImplementation(async (url, init) => {
    const path = String(url)
    if (init?.method === 'GET' && path === '/api/aspirations') return reply({ aspirations: rows })
    if (init?.method === 'GET' && path === '/api/goals') return reply({ goals })
    if (init?.method === 'GET' && path === '/api/recurring-items') return reply({ recurringItems })
    if (init?.method === 'GET' && path.startsWith('/api/weeks/')) return reply({ isCurrent: true, goals: WEEK_GOALS })
    if (init?.method === 'POST' && path === '/api/aspirations/reorder') {
      const { ids } = JSON.parse(String(init.body)) as { ids: string[] }
      rows = rows.map((row) => (ids.includes(row.id) ? { ...row, position: ids.indexOf(row.id) + 1 } : row))
      return reply({ aspirations: rows })
    }
    throw new Error(`Unexpected ${init?.method} ${path}`)
  })
}

function sent(call = 0) {
  const [url, init] = fetchMock.mock.calls[call]
  return { url, method: init?.method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getChoices', () => {
  it("reads the aspirations and goals only, for the Add sheet's pickers", async () => {
    serve([FIT, SPANISH], [STRONG, READING], [STRETCH])

    expect(await getChoices()).toEqual({ aspirations: [FIT, SPANISH], goals: [STRONG, READING] })
    expect(fetchMock.mock.calls.map(([url]) => String(url)).sort()).toEqual(['/api/aspirations', '/api/goals'])
  })
})

describe('getAspirations', () => {
  it('lists the aspirations, every goal with its progress, and the recurring items that are on', async () => {
    serve([FIT, SPANISH], [STRONG, READING], [STRETCH, OLD_RUNS, TRASH])

    expect(await getAspirations()).toEqual({
      aspirations: [FIT, SPANISH],
      goals: [STRONG, READING],
      recurringItems: [STRETCH, TRASH],
      weekGoals: WEEK_GOALS,
    })
    expect(fetchMock.mock.calls.map(([url]) => String(url).replace(/\d{4}-\d{2}-\d{2}$/, '{week}')).sort()).toEqual([
      '/api/aspirations',
      '/api/goals',
      '/api/recurring-items',
      '/api/weeks/{week}',
    ])
  })
})

describe('getAspiration', () => {
  it('picks the aspiration, its goals and its recurring items (on or off) from the lists, and counts the active ones', async () => {
    serve([FIT, HOME, SPANISH], [STRONG, CLEAN_HOUSE, READING], [STRETCH, OLD_RUNS, TRASH])

    expect(await getAspiration('fit')).toEqual({
      aspiration: FIT,
      goals: [STRONG],
      recurringItems: [STRETCH, OLD_RUNS],
      weekGoals: [WEEK_GOALS[0]],
      activeCount: 2,
    })
  })

  it('reports one that isn’t in the list as not found', async () => {
    serve([FIT])

    await expect(getAspiration('gone')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('addAspiration', () => {
  it('puts it at an id made on the device, trimmed, with a blank why as null', async () => {
    fetchMock.mockImplementation(() => reply(aspiration('new', 3)))

    await addAspiration({ name: '  Be generous ', why: '  ' })

    const { url, method, body } = sent()
    expect(method).toBe('PUT')
    expect(String(url)).toMatch(/^\/api\/aspirations\//)
    expect(String(url).split('/').pop()).toMatch(UUID_V4)
    expect(body).toEqual({ name: 'Be generous', why: null })
  })

  it('makes a new id for each aspiration', async () => {
    fetchMock.mockImplementation(() => reply(aspiration('new', 3)))

    await addAspiration({ name: 'One' })
    await addAspiration({ name: 'Two' })

    expect(sent(0).url).not.toBe(sent(1).url)
  })

  it('refuses a blank name without asking the API', async () => {
    await expect(addAspiration({ name: '   ' })).rejects.toThrow('An aspiration needs a name')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('updateAspiration', () => {
  it('sends the name and why together, trimmed', async () => {
    fetchMock.mockImplementation(() => reply({ ...FIT, name: 'Be fitter', why: 'Ski' }))

    const saved = await updateAspiration('fit', { name: ' Be fitter ', why: ' Ski ' })

    expect(sent()).toEqual({ url: '/api/aspirations/fit', method: 'PATCH', body: { name: 'Be fitter', why: 'Ski' } })
    expect(saved.name).toBe('Be fitter')
  })

  it('sends a cleared why as null', async () => {
    fetchMock.mockImplementation(() => reply(FIT))

    await updateAspiration('fit', { name: 'Be fit', why: '' })

    expect(sent().body).toEqual({ name: 'Be fit', why: null })
  })

  it('refuses a change without both fields, since the API takes them together', async () => {
    await expect(updateAspiration('fit', { name: 'Be fit' })).rejects.toThrow()
    await expect(updateAspiration('fit', { why: 'Ski' })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a blank name without asking the API', async () => {
    await expect(updateAspiration('fit', { name: ' ', why: '' })).rejects.toThrow('An aspiration needs a name')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('moveAspiration', () => {
  it('sends every active id in the new order, and returns the active ones in order', async () => {
    serve([SPANISH, HOME, FIT, READ])

    const order = await moveAspiration('home', 'up')

    expect(sent(1)).toEqual({ url: '/api/aspirations/reorder', method: 'POST', body: { ids: ['home', 'fit', 'read'] } })
    expect(order.map((row) => [row.id, row.position])).toEqual([
      ['home', 1],
      ['fit', 2],
      ['read', 3],
    ])
  })

  it('moves down', async () => {
    serve([FIT, HOME, READ])

    await moveAspiration('fit', 'down')

    expect(sent(1).body).toEqual({ ids: ['home', 'fit', 'read'] })
  })

  it('runs two quick moves one after the other, each on the order the last one left', async () => {
    serve([FIT, HOME, READ])

    const first = moveAspiration('read', 'up')
    const second = moveAspiration('read', 'up')
    await Promise.all([first, second])

    expect(sent(1).body).toEqual({ ids: ['fit', 'read', 'home'] })
    expect(sent(3).body).toEqual({ ids: ['read', 'fit', 'home'] })
  })

  it('refuses to move the first up or the last down, and a failed move doesn’t stop the next', async () => {
    serve([FIT, HOME])

    await expect(moveAspiration('fit', 'up')).rejects.toThrow('fit is already first')
    await expect(moveAspiration('home', 'down')).rejects.toThrow('home is already last')
    await moveAspiration('home', 'up')

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })

  it('reports a retired or missing aspiration as not found', async () => {
    serve([FIT, SPANISH])

    await expect(moveAspiration('spanish', 'up')).rejects.toBeInstanceOf(NotFoundError)
    await expect(moveAspiration('gone', 'up')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('retireAspiration', () => {
  it('posts what happens to its work', async () => {
    fetchMock.mockImplementation(() => reply({ ...FIT, status: 'retired', position: null, retiredOn: '2026-11-11' }))

    const saved = await retireAspiration('fit', 'keep')

    expect(sent()).toEqual({ url: '/api/aspirations/fit/retire', method: 'POST', body: { itsWork: 'keep' } })
    expect(saved.status).toBe('retired')
  })
})

describe('bringBackAspiration', () => {
  it('posts to bring it back, with no body', async () => {
    fetchMock.mockImplementation(() => reply({ ...SPANISH, status: 'active', position: 3, retiredOn: null }))

    const saved = await bringBackAspiration('spanish')

    expect(sent()).toEqual({ url: '/api/aspirations/spanish/bring-back', method: 'POST', body: undefined })
    expect(saved.position).toBe(3)
  })
})

describe('deleteAspiration', () => {
  it('deletes an aspiration', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))

    await expect(deleteAspiration('a1')).resolves.toBeUndefined()
    expect(sent()).toEqual({ url: '/api/aspirations/a1', method: 'DELETE', body: undefined })
  })
})
