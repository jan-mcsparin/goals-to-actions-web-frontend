import { afterEach, describe, expect, it, vi } from 'vitest'
import { readWeekView, saveWeekView } from './weekView.ts'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Week view preference', () => {
  it('defaults to this week', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readWeekView()).toBe('this')
  })

  it('remembers the chosen view', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveWeekView('next')

    expect(readWeekView()).toBe('next')
  })

  it('falls back to this week when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })

    expect(readWeekView()).toBe('this')
    expect(() => saveWeekView('next')).not.toThrow()
  })
})
