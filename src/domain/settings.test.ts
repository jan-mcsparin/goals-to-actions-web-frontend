import { describe, expect, it } from 'vitest'
import { INTENSITIES, isIntensity } from './settings.ts'

describe('INTENSITIES', () => {
  it('lists Easing off, Normal and Going hard, in that order', () => {
    expect(INTENSITIES).toEqual([
      { value: 'easingOff', label: 'Easing off' },
      { value: 'normal', label: 'Normal' },
      { value: 'goingHard', label: 'Going hard' },
    ])
  })
})

describe('isIntensity', () => {
  it('accepts the three intensities and nothing else', () => {
    expect(INTENSITIES.every(({ value }) => isIntensity(value))).toBe(true)
    expect(isIntensity('flatOut')).toBe(false)
    expect(isIntensity('')).toBe(false)
  })
})
