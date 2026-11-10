import { afterEach, describe, expect, it, vi } from 'vitest'
import { readScreen, saveScreen } from './navigation.ts'

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

describe('current screen', () => {
  it('defaults to Today', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readScreen()).toEqual({ screen: 'today' })
  })

  it('remembers the week and an opened day', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveScreen({ screen: 'week' })
    expect(readScreen()).toEqual({ screen: 'week' })

    saveScreen({ screen: 'day', date: '2026-11-12' })
    expect(readScreen()).toEqual({ screen: 'day', date: '2026-11-12' })
  })

  it.each(['not json', '{"screen":"goals"}', '{"screen":"day"}', '{"screen":"day","date":"Thursday"}'])(
    'falls back to Today for a bad stored value: %s',
    (stored) => {
      const storage = memoryStorage()
      storage.setItem('gta.screen', stored)
      vi.stubGlobal('localStorage', storage)

      expect(readScreen()).toEqual({ screen: 'today' })
    },
  )

  it('works without storage, as in private browsing', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })

    expect(() => saveScreen({ screen: 'week' })).not.toThrow()
    expect(readScreen()).toEqual({ screen: 'today' })
  })
})
