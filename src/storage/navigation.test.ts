import { afterEach, describe, expect, it, vi } from 'vitest'
import { readScreen, saveScreen, tabOf, type Screen } from './navigation.ts'

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

  it.each<Screen>([
    { screen: 'aspirations' },
    { screen: 'aspiration', aspirationId: 'asp-fit' },
    { screen: 'upkeep' },
    { screen: 'settings' },
    { screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } },
    { screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspiration', aspirationId: 'asp-fit' } },
  ])('remembers $screen', (opened) => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveScreen(opened)

    expect(readScreen()).toEqual(opened)
  })

  it.each([
    'not json',
    '{"screen":"goals"}',
    '{"screen":"day"}',
    '{"screen":"day","date":"Thursday"}',
    '{"screen":"aspiration"}',
    '{"screen":"aspiration","aspirationId":7}',
    '{"screen":"aspiration","aspirationId":""}',
    '{"screen":"goal","goalId":"","from":{"screen":"aspirations"}}',
    '{"screen":"goal","from":{"screen":"aspirations"}}',
    '{"screen":"goal","goalId":"goal-strong"}',
    '{"screen":"goal","goalId":"goal-strong","from":{"screen":"week"}}',
    '{"screen":"goal","goalId":"goal-strong","from":{"screen":"aspiration"}}',
  ])(
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

describe('tabOf', () => {
  it.each<[Screen, string]>([
    [{ screen: 'today' }, 'today'],
    [{ screen: 'week' }, 'week'],
    [{ screen: 'day', date: '2026-11-12' }, 'week'],
    [{ screen: 'aspirations' }, 'aspirations'],
    [{ screen: 'aspiration', aspirationId: 'asp-fit' }, 'aspirations'],
    [{ screen: 'upkeep' }, 'aspirations'],
    [{ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } }, 'aspirations'],
  ])('counts %o as the %s tab', (opened, tab) => {
    expect(tabOf(opened)).toBe(tab)
  })
})
