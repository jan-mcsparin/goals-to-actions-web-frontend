import { afterEach, describe, expect, it, vi } from 'vitest'
import { newDeviceId } from './ids.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newDeviceId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('makes a version 4 UUID', () => {
    expect(newDeviceId()).toMatch(UUID_V4)
  })

  it('makes a different one each time', () => {
    expect(newDeviceId()).not.toBe(newDeviceId())
  })

  it('works where the browser leaves out randomUUID, as on the plain-http dev server', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })

    expect(newDeviceId()).toMatch(UUID_V4)
  })
})
