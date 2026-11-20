import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNotNow, saveNotNow } from './stillMattersNotNow.ts'

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

describe('Still matter? "Not now"', () => {
  it('starts empty', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readNotNow('2026-11-11')).toEqual([])
  })

  it('remembers the tasks for that day only', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveNotNow('2026-11-11', ['a', 'b'])

    expect(readNotNow('2026-11-11')).toEqual(['a', 'b'])
    expect(readNotNow('2026-11-12')).toEqual([])
  })

  it('reads as empty when storage is blocked or holds something else', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(readNotNow('2026-11-11')).toEqual([])
    expect(() => saveNotNow('2026-11-11', ['a'])).not.toThrow()

    vi.stubGlobal('localStorage', { getItem: () => '{"day":"2026-11-11","ids":5}', setItem: () => {} })
    expect(readNotNow('2026-11-11')).toEqual([])
  })
})
