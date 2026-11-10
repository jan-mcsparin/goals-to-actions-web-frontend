import { render, screen, within } from '@testing-library/react'
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

it('switches to Aspirations and remembers it', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')

  unmount()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
})

it('lists the tabs as Today, Week, Aspirations', async () => {
  render(<App />)

  const tabs = within(await screen.findByRole('navigation', { name: 'Screens' })).getAllByRole('button')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Today', 'Week', 'Aspirations'])
})

it('opens an aspiration from its card and comes back', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))

  await user.click(await screen.findByRole('button', { name: 'Be fit' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')

  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
})

it('opens a goal from its row and comes back to the tab', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))

  await user.click(await screen.findByRole('button', { name: /^Be strong/ }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Be strong' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
  expect(JSON.parse(localStorage.getItem('gta.screen')!)).toEqual({
    screen: 'goal',
    goalId: 'goal-strong',
    from: { screen: 'aspirations' },
  })

  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
})

it('goes back from a goal to the aspiration it was opened from', async () => {
  localStorage.setItem(
    'gta.screen',
    JSON.stringify({ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspiration', aspirationId: 'asp-fit' } }),
  )
  const user = userEvent.setup()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Be strong' })).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Back to Be fit' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
})

it('restores an opened aspiration and an opened goal after a remount', async () => {
  const user = userEvent.setup()
  const first = render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Keep a calm home' }))
  first.unmount()

  const second = render(<App />)
  expect(await screen.findByRole('heading', { level: 1, name: 'Keep a calm home' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')

  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))
  await user.click(await screen.findByRole('button', { name: /^Clear out the garage/ }))
  second.unmount()

  render(<App />)
  expect(await screen.findByRole('heading', { level: 1, name: 'Clear out the garage' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
})

it('shows only the way back for an aspiration or goal that no longer exists', async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'aspiration', aspirationId: 'asp-gone' }))
  const user = userEvent.setup()
  render(<App />)

  const back = await screen.findByRole('button', { name: 'Back to Aspirations' })
  await screen.findByRole('main', { busy: false })
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()

  await user.click(back)

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
})

it('opens Keep life running from its row, comes back, and restores it after a remount', async () => {
  const user = userEvent.setup()
  const first = render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))

  await user.click(await screen.findByRole('button', { name: /^Keep life running/ }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Keep life running' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')

  first.unmount()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Keep life running' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')

  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
})
