import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App.tsx'
import { APP_NAME } from './config.ts'

it('renders the app name', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: APP_NAME })).toBeDefined()
})
