// Runs before each .tsx test file. Vitest globals are off, so RTL can't
// register its own cleanup; unmount rendered trees between tests here.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
