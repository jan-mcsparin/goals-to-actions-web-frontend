import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planStore, resetPlanStore } from './planStore.ts'
import type { Week } from '../api/types.ts'

function aWeek(week: string): Week {
  return { week, isCurrent: true, nextWeekOpen: false, tasks: [], goals: [], days: [], quittingGoals: [] }
}

beforeEach(() => {
  resetPlanStore()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('planStore', () => {
  it('keeps each week as it was put, by its Monday', async () => {
    const { weeks } = planStore()

    await weeks.put('2026-11-09', aWeek('2026-11-09'))
    await weeks.put('2026-11-16', aWeek('2026-11-16'))

    expect(await weeks.get('2026-11-09')).toEqual(aWeek('2026-11-09'))
    expect(await weeks.get('2026-11-23')).toBeUndefined()
  })

  it('hands back a copy, so changing what was read changes nothing stored', async () => {
    const { weeks } = planStore()
    await weeks.put('2026-11-09', aWeek('2026-11-09'))

    const read = await weeks.get('2026-11-09')
    read!.isCurrent = false

    expect((await weeks.get('2026-11-09'))?.isCurrent).toBe(true)
  })

  it('lists the queue in order of its keys, and deletes one', async () => {
    const { queue } = planStore()
    await queue.put(2, 'second')
    await queue.put(1, 'first')
    await queue.put(3, 'third')

    await queue.delete(2)

    expect(await queue.entries()).toEqual([
      [1, 'first'],
      [3, 'third'],
    ])
  })

  it('clears both stores', async () => {
    const store = planStore()
    await store.weeks.put('2026-11-09', aWeek('2026-11-09'))
    await store.queue.put(1, 'first')

    await store.clear()

    expect(await store.weeks.entries()).toEqual([])
    expect(await store.queue.entries()).toEqual([])
  })

  it('starts empty again after a reset', async () => {
    await planStore().queue.put(1, 'first')

    resetPlanStore()

    expect(await planStore().queue.entries()).toEqual([])
  })

  it('asks once to keep its storage, on the first write', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', { storage: { persist } })
    const { weeks, queue } = planStore()

    await weeks.put('2026-11-09', aWeek('2026-11-09'))
    await queue.put(1, 'first')

    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('writes even where the browser has no way to ask', async () => {
    vi.stubGlobal('navigator', {})

    await planStore().queue.put(1, 'first')

    expect(await planStore().queue.entries()).toEqual([[1, 'first']])
  })
})
