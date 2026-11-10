import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTodayView, saveTodayView } from './viewPreference.ts'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
}

function blockedStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const blocked = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  return { getItem: blocked, setItem: blocked }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Today view preference', () => {
  it('defaults to the list view', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readTodayView()).toBe('list')
  })

  it('remembers the chosen view', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveTodayView('byGoal')

    expect(readTodayView()).toBe('byGoal')
  })

  it('falls back to the list view for an unknown stored value', () => {
    const storage = memoryStorage()
    storage.setItem('gta.todayView', 'grid')
    vi.stubGlobal('localStorage', storage)

    expect(readTodayView()).toBe('list')
  })

  it('works without storage, as in private browsing', () => {
    vi.stubGlobal('localStorage', blockedStorage())

    expect(() => saveTodayView('byGoal')).not.toThrow()
    expect(readTodayView()).toBe('list')
  })
})
