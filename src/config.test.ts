import { describe, expect, it } from 'vitest'
import { APP_NAME } from './config.ts'

describe('config', () => {
  it('exports the product name', () => {
    expect(APP_NAME).toBe('Goals to Actions')
  })
})
