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

it('lands on Aspirations, quietly, for a remembered aspiration that no longer exists', async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'aspiration', aspirationId: 'asp-gone' }))
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  expect(JSON.parse(localStorage.getItem('gta.screen')!)).toEqual({ screen: 'aspirations' })
})

it('shows a new priority order on the tab after moving an aspiration', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Be fit' }))

  await user.click(await screen.findByRole('button', { name: 'Move down' }))
  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))

  await screen.findByRole('heading', { level: 1, name: 'Aspirations' })
  const cards = await screen.findAllByRole('button', { name: /^(Be fit|Keep a calm home)$/ })
  expect(cards).toEqual([
    screen.getByRole('button', { name: 'Keep a calm home' }),
    screen.getByRole('button', { name: 'Be fit' }),
  ])
})

it('lands on the tab after retiring, with the aspiration under Retired', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Be fit' }))

  await user.click(await screen.findByRole('button', { name: 'Retire' }))
  await user.click(screen.getByRole('button', { name: 'Retire Be fit' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  const retired = screen.getByText('Retired (2)').closest('details')!
  expect(within(retired).getByRole('button', { name: 'Be fit' })).toBeDefined()
  expect(screen.queryByRole('region', { name: 'Be fit' })).toBeNull()
})

it('shows what retiring paused, and brings it back last with its goals still paused', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Be fit' }))
  await user.click(await screen.findByRole('button', { name: 'Retire' }))
  await user.click(screen.getByRole('button', { name: 'Retire Be fit' }))

  const retired = (await screen.findByText('Retired (2)')).closest('details')!
  await user.click(within(retired).getByText('Retired (2)'))
  await user.click(within(retired).getByRole('button', { name: 'Be fit' }))

  const paused = await screen.findByRole('region', { name: 'Paused goals' })
  expect(within(paused).getAllByRole('button')).toHaveLength(3)
  const recurring = screen.getByRole('region', { name: 'Recurring' })
  expect(within(recurring).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
    'StretchPaused',
    'HockeyPaused',
  ])

  await user.click(screen.getByRole('button', { name: 'Bring back' }))

  const priority = await screen.findByRole('region', { name: 'Priority' })
  expect(within(priority).getByText('2nd of 2 aspirations')).toBeDefined()
  const goals = screen.getByRole('region', { name: 'Goals' })
  expect(within(goals).getByText('0 active')).toBeDefined()
  expect(within(goals).getAllByText('Paused')).toHaveLength(3)
})

it('puts the goals under Other goals after retiring with Keep them going', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Be fit' }))

  await user.click(await screen.findByRole('button', { name: 'Retire' }))
  await user.click(screen.getByRole('radio', { name: /^Keep them going/ }))
  await user.click(screen.getByRole('button', { name: 'Retire Be fit' }))

  const other = await screen.findByRole('region', { name: 'Other goals' })
  expect(within(other).getByRole('button', { name: /^Be strong/ })).toBeDefined()
})

it('opens a goal from an aspiration page and comes back to it', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Be fit' }))

  await user.click(await screen.findByRole('button', { name: /^Have endurance/ }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Have endurance' })).toBeDefined()
  expect(JSON.parse(localStorage.getItem('gta.screen')!)).toEqual({
    screen: 'goal',
    goalId: 'goal-endurance',
    from: { screen: 'aspiration', aspirationId: 'asp-fit' },
  })

  await user.click(screen.getByRole('button', { name: 'Back to Be fit' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()
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

it('says only "Back" on a goal whose aspiration no longer exists, and lands on Aspirations', async () => {
  localStorage.setItem(
    'gta.screen',
    JSON.stringify({ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspiration', aspirationId: 'asp-gone' } }),
  )
  const user = userEvent.setup()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Be strong' })).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Back to Aspirations' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
})

it('lands on Aspirations, quietly, for a remembered goal that no longer exists', async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'goal', goalId: 'goal-gone', from: { screen: 'aspirations' } }))
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
})

it("opens a goal's aspiration from the link under its name", async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } }))
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Be fit ›' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()
  expect(JSON.parse(localStorage.getItem('gta.screen')!)).toEqual({ screen: 'aspiration', aspirationId: 'asp-fit' })
})

it("changes Week's count when a goal's weekly target changes", async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } }))
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Edit weekly target' }))
  const sheet = screen.getByRole('dialog', { name: 'Weekly target' })
  await user.clear(within(sheet).getByRole('textbox', { name: 'Amount' }))
  await user.type(within(sheet).getByRole('textbox', { name: 'Amount' }), '4')
  await user.click(within(sheet).getByRole('button', { name: 'Save' }))
  await user.click(screen.getByRole('button', { name: 'Week' }))

  const progress = await screen.findByRole('region', { name: 'Progress' })
  expect(await within(progress).findByText('1 of 4')).toBeDefined()
})
