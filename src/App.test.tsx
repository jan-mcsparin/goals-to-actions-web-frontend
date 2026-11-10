import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetStore } from './api/mockStore.ts'
import App from './App.tsx'

// Wednesday 11 Nov 2026, 9 a.m. local time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function currentTab() {
  return screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'page')?.textContent
}

it('opens on Today, with Today as the current tab', async () => {
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Today · Wednesday' })).toBeDefined()
  expect(currentTab()).toBe('Today')
})

it('switches to Week and remembers it', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Week' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
  expect(currentTab()).toBe('Week')

  unmount()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
})

it('restores an opened day under the Week tab, with a way back', async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'day', date: '2026-11-12' }))
  const user = userEvent.setup()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Thursday · Nov 12' })).toBeDefined()
  expect(currentTab()).toBe('Week')

  await user.click(screen.getByRole('button', { name: 'Back to Week' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
})

it('opens a day from the Week screen and comes back', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Week' }))

  await user.click(await screen.findByRole('button', { name: /^Thu/ }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Thursday · Nov 12' })).toBeDefined()
  expect(currentTab()).toBe('Week')
  await user.click(screen.getByRole('button', { name: 'Back to Week' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
})
