import { describe, expect, it } from 'vitest'
import { realApi } from './mode.ts'

describe('realApi', () => {
  it('is off in tests, so no test reaches the network', () => {
    expect(realApi).toBe(false)
  })
})
