import { describe, expect, it } from 'vitest'
import { bannerLine, safeLine, unsentLine } from './session.ts'

describe('safeLine', () => {
  it.each([
    [0, 'Everything you did is safe on this phone.'],
    [1, "Everything you did is safe on this phone: 1 change will send as soon as you're back in."],
    [3, "Everything you did is safe on this phone: 3 changes will send as soon as you're back in."],
  ])('with %i waiting', (waiting, line) => {
    expect(safeLine(waiting)).toBe(line)
  })
})

describe('bannerLine', () => {
  it.each([
    [0, 'Not signed in'],
    [1, 'Not signed in · 1 change waiting'],
    [3, 'Not signed in · 3 changes waiting'],
  ])('with %i waiting', (waiting, line) => {
    expect(bannerLine(waiting)).toBe(line)
  })
})

describe('unsentLine', () => {
  it.each([
    [1, "1 change hasn't been sent yet."],
    [3, "3 changes haven't been sent yet."],
  ])('with %i unsent', (unsent, line) => {
    expect(unsentLine(unsent)).toBe(line)
  })
})
