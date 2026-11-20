// The aspiration functions of api/client.ts, on the real API. Same signatures
// as the mock ones, so hooks and screens don't know which they got.
//
// The API has no read for one aspiration or for the whole tab, so both are
// built from the aspiration, goal and recurring item lists. This week's tasks
// come back empty until the bars read the week (#42).
import { NotFoundError } from './errors.ts'
import { newDeviceId } from './ids.ts'
import type { components } from './openapi.ts'
import { listGoals } from './realGoals.ts'
import { listRecurringItems } from './realPlan.ts'
import { request } from './request.ts'
import type { Aspiration, AspirationDetail, AspirationsOverview, NewAspiration } from './types.ts'

type AspirationList = components['schemas']['AspirationList']

const NOTHING_ELSE = { weekTasks: [] }

export async function getAspirations(): Promise<AspirationsOverview> {
  const [aspirations, goals, items] = await Promise.all([listAspirations(), listGoals(), listRecurringItems()])
  return { aspirations, goals, recurringItems: items.filter((item) => item.active), ...NOTHING_ELSE }
}

export async function getAspiration(aspirationId: string): Promise<AspirationDetail> {
  const [aspirations, goals, items] = await Promise.all([listAspirations(), listGoals(), listRecurringItems()])
  return {
    aspiration: findIn(aspirations, aspirationId),
    goals: goals.filter((goal) => goal.aspirationId === aspirationId),
    recurringItems: items.filter((item) => item.aspirationId === aspirationId),
    ...NOTHING_ELSE,
    activeCount: inOrder(aspirations).length,
  }
}

// At an id made here, so sending it again makes no second aspiration.
export async function addAspiration(aspiration: NewAspiration): Promise<Aspiration> {
  return request('PUT', `/aspirations/${newDeviceId()}`, nameAndWhy(aspiration.name, aspiration.why))
}

// The API takes the name and why together, so both must be given.
export async function updateAspiration(
  aspirationId: string,
  changes: { name?: string; why?: string },
): Promise<Aspiration> {
  if (changes.name === undefined || changes.why === undefined) {
    throw new Error('An aspiration is saved with its name and why together')
  }
  return request('PATCH', `/aspirations/${aspirationId}`, nameAndWhy(changes.name, changes.why))
}

// The API takes the whole order, so this reads it, swaps the two, and sends it.
// Moves run one after another, so quick taps each start from the last one's order.
let moving: Promise<unknown> = Promise.resolve()

export function moveAspiration(aspirationId: string, direction: 'up' | 'down'): Promise<Aspiration[]> {
  const move = moving.then(() => swapAndSend(aspirationId, direction))
  moving = move.catch(() => {})
  return move
}

export async function retireAspiration(aspirationId: string, itsWork: 'pause' | 'keep'): Promise<Aspiration> {
  return request('POST', `/aspirations/${aspirationId}/retire`, { itsWork })
}

export async function bringBackAspiration(aspirationId: string): Promise<Aspiration> {
  return request('POST', `/aspirations/${aspirationId}/bring-back`)
}

async function swapAndSend(aspirationId: string, direction: 'up' | 'down'): Promise<Aspiration[]> {
  const order = inOrder(await listAspirations())
  const index = order.findIndex((aspiration) => aspiration.id === aspirationId)
  if (index === -1) throw new NotFoundError(`No active aspiration with id ${aspirationId}`)
  const other = direction === 'up' ? index - 1 : index + 1
  if (other < 0 || other >= order.length) {
    throw new Error(`${aspirationId} is already ${direction === 'up' ? 'first' : 'last'}`)
  }

  const ids = order.map((aspiration) => aspiration.id)
  ;[ids[index], ids[other]] = [ids[other], ids[index]]
  const { aspirations } = await request<AspirationList>('POST', '/aspirations/reorder', { ids })
  return inOrder(aspirations)
}

async function listAspirations(): Promise<Aspiration[]> {
  return (await request<AspirationList>('GET', '/aspirations')).aspirations
}

function findIn(aspirations: Aspiration[], aspirationId: string): Aspiration {
  const aspiration = aspirations.find((candidate) => candidate.id === aspirationId)
  if (!aspiration) throw new NotFoundError(`No aspiration with id ${aspirationId}`)
  return aspiration
}

// The active ones, first priority first.
function inOrder(aspirations: Aspiration[]): Aspiration[] {
  return aspirations
    .filter((aspiration) => aspiration.status === 'active')
    .sort((a, b) => a.position! - b.position!)
}

// Trimmed, with a blank why sent as null, as the mock saves them.
function nameAndWhy(name: string, why?: string | null) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('An aspiration needs a name')
  return { name: trimmed, why: why?.trim() || null }
}
