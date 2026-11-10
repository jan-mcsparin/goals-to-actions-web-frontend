import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App.tsx'

it('opens on Today', async () => {
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: /^Today · / })).toBeDefined()
})
