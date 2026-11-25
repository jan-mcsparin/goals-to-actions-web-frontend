import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getChoices, turnOffRecurringItem, turnOnRecurringItem, updateRecurringItem } from '../api/client.ts'
import { resetStore, store } from '../api/mockStore.ts'
import type { RecurringItem } from '../api/types.ts'
import { WEEKDAY_OPTIONS } from '../domain/add.ts'
import { useRecurringEdit } from './useRecurringEdit.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getChoices: vi.fn(actual.getChoices),
    updateRecurringItem: vi.fn(actual.updateRecurringItem),
    turnOffRecurringItem: vi.fn(actual.turnOffRecurringItem),
    turnOnRecurringItem: vi.fn(actual.turnOnRecurringItem),
  }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getChoices).mockClear()
  vi.mocked(updateRecurringItem).mockClear()
  vi.mocked(turnOffRecurringItem).mockClear()
  vi.mocked(turnOnRecurringItem).mockClear()
})

function trash(): RecurringItem {
  return structuredClone(store.recurringItems.find((item) => item.id === 'rec-trash')!)
}

function setUp(items: RecurringItem[] = [trash()]) {
  const reload = vi.fn(async () => {})
  const rendered = renderHook(() => useRecurringEdit(items, reload))
  return { ...rendered, reload }
}

describe('useRecurringEdit', () => {
  it('opens on an item, filled in, with Save off', async () => {
    const { result } = setUp()

    act(() => result.current.open('rec-trash'))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.draft).toMatchObject({ name: 'Take out the trash', fixedDay: true, aspirationId: 'asp-home' })
    expect(result.current.canSave).toBe(false)
    expect(result.current.paused).toBe(false)
    await waitFor(() => expect(result.current.aspirations.map((choice) => choice.id)).toContain('asp-home'))
  })

  it('saves a change, then closes and has the screen read again', async () => {
    const { result, reload } = setUp()
    act(() => result.current.open('rec-trash'))
    act(() => result.current.change({ name: 'Trash and recycling', fixed: WEEKDAY_OPTIONS[2].value, aspirationId: '' }))
    expect(result.current.canSave).toBe(true)

    await act(() => result.current.save())

    expect(updateRecurringItem).toHaveBeenCalledWith('rec-trash', {
      name: 'Trash and recycling',
      aspirationId: null,
      schedule: { kind: 'weekly', weekday: 'wednesday' },
      startsOn: '2026-10-01',
    })
    expect(result.current.isOpen).toBe(false)
    expect(reload).toHaveBeenCalled()
  })

  it('keeps the sheet and what was typed when the save fails', async () => {
    vi.mocked(updateRecurringItem).mockRejectedValueOnce(new Error('offline'))
    const { result, reload } = setUp()
    act(() => result.current.open('rec-trash'))
    act(() => result.current.change({ name: 'Trash and recycling' }))

    await act(() => result.current.save())

    expect(result.current.isOpen).toBe(true)
    expect(result.current.draft?.name).toBe('Trash and recycling')
    expect(result.current.message).toBe("Couldn't save that. Try again.")
    expect(reload).not.toHaveBeenCalled()
  })

  it('lets the message go once something else is typed', async () => {
    vi.mocked(updateRecurringItem).mockRejectedValueOnce(new Error('offline'))
    const { result } = setUp()
    act(() => result.current.open('rec-trash'))
    act(() => result.current.change({ name: 'Trash and recycling' }))
    await act(() => result.current.save())

    act(() => result.current.change({ name: 'Trash' }))

    expect(result.current.message).toBeUndefined()
  })

  it('does nothing while a save is on its way', async () => {
    const { result } = setUp()
    act(() => result.current.open('rec-trash'))
    act(() => result.current.change({ name: 'Trash and recycling' }))

    await act(async () => {
      void result.current.save()
      await result.current.save()
    })

    expect(updateRecurringItem).toHaveBeenCalledTimes(1)
  })

  it('pauses an item at once, then closes and reads again', async () => {
    const { result, reload } = setUp()
    act(() => result.current.open('rec-trash'))

    await act(() => result.current.pause())

    expect(turnOffRecurringItem).toHaveBeenCalledWith('rec-trash')
    expect(result.current.isOpen).toBe(false)
    expect(reload).toHaveBeenCalled()
  })

  it('resumes a paused item', async () => {
    const { result, reload } = setUp([{ ...trash(), active: false }])
    act(() => result.current.open('rec-trash'))
    expect(result.current.paused).toBe(true)

    await act(() => result.current.resume())

    expect(turnOnRecurringItem).toHaveBeenCalledWith('rec-trash')
    expect(reload).toHaveBeenCalled()
  })

  it('keeps the sheet open with the message when pausing fails', async () => {
    vi.mocked(turnOffRecurringItem).mockRejectedValueOnce(new Error('offline'))
    const { result } = setUp()
    act(() => result.current.open('rec-trash'))

    await act(() => result.current.pause())

    expect(result.current.isOpen).toBe(true)
    expect(result.current.message).toBe("Couldn't save that. Try again.")
  })

  it('starts again from the item each time it opens', () => {
    const { result } = setUp()
    act(() => result.current.open('rec-trash'))
    act(() => result.current.change({ name: 'Trash and recycling' }))
    act(() => result.current.close())

    act(() => result.current.open('rec-trash'))

    expect(result.current.draft?.name).toBe('Take out the trash')
  })

  it('says so when the aspirations fail to load', async () => {
    vi.mocked(getChoices).mockRejectedValueOnce(new Error('offline'))
    const { result } = setUp()

    act(() => result.current.open('rec-trash'))

    await waitFor(() => expect(result.current.aspirationsMessage).toBe("Couldn't load your aspirations. Try again in a moment."))
  })
})
