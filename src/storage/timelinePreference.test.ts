import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTimelineExpanded, saveTimelineExpanded } from './timelinePreference.ts'

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

describe('Timeline Show all preference', () => {
  it('starts condensed', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readTimelineExpanded('goal-strong')).toBe(false)
  })

  it('remembers each goal on its own', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    saveTimelineExpanded('goal-strong', true)
    saveTimelineExpanded('goal-garage', true)
    saveTimelineExpanded('goal-garage', false)

    expect(readTimelineExpanded('goal-strong')).toBe(true)
    expect(readTimelineExpanded('goal-garage')).toBe(false)
  })

  it('saving twice keeps one entry', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    saveTimelineExpanded('goal-strong', true)
    saveTimelineExpanded('goal-strong', true)

    expect(JSON.parse(storage.getItem('gta.timelineExpanded')!)).toEqual(['goal-strong'])
  })

  it('falls back to condensed for junk in storage', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    for (const junk of ['not json', '{"goal-strong":true}', '[1,2]']) {
      storage.setItem('gta.timelineExpanded', junk)
      expect(readTimelineExpanded('goal-strong')).toBe(false)
      expect(() => saveTimelineExpanded('goal-strong', true)).not.toThrow()
    }
  })

  it('works without storage, as in private browsing', () => {
    vi.stubGlobal('localStorage', blockedStorage())

    expect(() => saveTimelineExpanded('goal-strong', true)).not.toThrow()
    expect(readTimelineExpanded('goal-strong')).toBe(false)
  })
})
