import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resumeGoal, retireAspiration } from './api/client.ts'
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

// The Aspirations tab's cards, in order.
function aspirationCardNames() {
  return screen
    .queryAllByRole('region')
    .filter((region) => region.classList.contains('aspiration-card'))
    .map((card) => document.getElementById(card.getAttribute('aria-labelledby')!)?.textContent)
}

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

it('lists the tab bar as Today, Week, + (Add), Aspirations', async () => {
  render(<App />)

  const tabs = within(await screen.findByRole('navigation', { name: 'Screens' })).getAllByRole('button')
  expect(tabs.map((tab) => tab.textContent)).toEqual(['Today', 'Week', '+', 'Aspirations'])
  expect(tabs[2].getAttribute('aria-label')).toBe('Add')
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

it('shows a goal resumed under a retired aspiration under Other goals, active on its page, and on Week and Today', async () => {
  await retireAspiration('asp-fit', 'pause')
  await resumeGoal('goal-strong')
  const user = userEvent.setup()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Today · Wednesday' })).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Week' }))
  const progress = await screen.findByRole('region', { name: 'Progress' })
  expect(within(progress).getByText('Be strong · Be fit')).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Aspirations' }))
  const other = await screen.findByRole('region', { name: 'Other goals' })
  expect(within(other).getByRole('button', { name: /^Be strong/ })).toBeDefined()

  const retired = screen.getByText('Retired (2)').closest('details')!
  await user.click(within(retired).getByText('Retired (2)'))
  await user.click(within(retired).getByRole('button', { name: 'Be fit' }))
  const active = await screen.findByRole('region', { name: 'Active goals' })
  expect(within(active).getByRole('button', { name: /^Be strong/ })).toBeDefined()
  expect(within(screen.getByRole('region', { name: 'Paused goals' })).getAllByRole('button')).toHaveLength(2)
})

it("pausing a goal takes it out of Week and reads Paused on the tab; resuming puts its tasks back in the bank", async () => {
  localStorage.setItem('gta.screen', JSON.stringify({ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } }))
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Pause' }))
  await screen.findByText('Building · Paused')

  await user.click(screen.getByRole('button', { name: 'Week' }))
  const progress = await screen.findByRole('region', { name: 'Progress' })
  expect(within(progress).queryByText('Be strong · Be fit')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Aspirations' }))
  expect(await screen.findByRole('button', { name: /^Be strong\s*Paused/ })).toBeDefined()

  await user.click(screen.getByRole('button', { name: /^Be strong/ }))
  await user.click(await screen.findByRole('button', { name: 'Resume' }))
  await screen.findByRole('button', { name: 'Pause' })
  await user.click(screen.getByRole('button', { name: 'Week' }))
  expect(within(await screen.findByRole('region', { name: 'Progress' })).getByText('Be strong · Be fit')).toBeDefined()
})

describe('the Add sheet', () => {
  function placementShown() {
    const sheet = screen.getByRole('dialog', { name: 'Add' })
    return within(sheet)
      .getAllByRole('radio')
      .find((radio) => (radio as HTMLInputElement).checked)
      ?.closest('label')?.textContent
  }

  it.each([
    [{ screen: 'today' }, 'Today · Wednesday'],
    [{ screen: 'week' }, 'This week'],
    [{ screen: 'day', date: '2026-11-12' }, 'Thursday · Nov 12'],
    [{ screen: 'aspirations' }, 'Aspirations'],
    [{ screen: 'aspiration', aspirationId: 'asp-fit' }, 'Be fit'],
    [{ screen: 'upkeep' }, 'Keep life running'],
    [{ screen: 'goal', goalId: 'goal-strong', from: { screen: 'aspirations' } }, 'Be strong'],
  ])('opens from the + over %j, which stays the current screen', async (opened, heading) => {
    localStorage.setItem('gta.screen', JSON.stringify(opened))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: heading })
    const tabBefore = currentTab()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByRole('dialog', { name: 'Add' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-current')).toBeNull()
    expect(currentTab()).toBe(tabBefore)
    expect(placementShown()).toBe(opened.screen === 'today' ? 'On today' : 'In the bank')
  })

  it("adds a task onto Today from Today, and says so", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Today · Wednesday' })

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Call the vet')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('Call the vet')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Added to today.')
  })

  it("adds a task to the bank from Week, and Week's bank shows it", async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'week' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'This week' })

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Fill out my ballot')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const bank = screen.getByRole('region', { name: /^Bank/ })
    expect(await within(bank).findByText('Fill out my ballot')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe("Added to this week's bank.")
  })

  it('shows the same confirmation again for a second add', async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'week' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'This week' })
    async function addTask(title: string) {
      await user.click(screen.getByRole('button', { name: 'Add' }))
      await user.type(screen.getByRole('textbox', { name: 'Title' }), title)
      await user.click(screen.getByRole('button', { name: 'Save' }))
    }

    await addTask('Fill out my ballot')
    await user.click(screen.getByRole('status').querySelector('button')!)
    expect(screen.queryByRole('status')).toBeNull()
    await addTask('Water the plants')

    expect(screen.getByRole('status').textContent).toBe("Added to this week's bank.")
  })

  describe('saving a goal', () => {
    async function addGoal(fill: (user: ReturnType<typeof userEvent.setup>) => Promise<void>) {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByRole('heading', { level: 1, name: 'Today · Wednesday' })
      await user.click(screen.getByRole('button', { name: 'Add' }))
      await user.click(screen.getByRole('button', { name: 'Goal' }))
      await fill(user)
      await user.click(screen.getByRole('button', { name: 'Save' }))
      return user
    }

    it("opens the goal's page, and back goes to its aspiration", async () => {
      const user = await addGoal(async (user) => {
        await user.click(screen.getByRole('button', { name: 'Building' }))
        await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Be strong 2: bench 185')
        await screen.findByRole('option', { name: 'Be fit' })
        await user.selectOptions(screen.getByRole('combobox', { name: "What's this for?" }), 'Be fit')
      })

      expect(await screen.findByRole('heading', { level: 1, name: 'Be strong 2' })).toBeDefined()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe("Saved. Add milestones when you're ready.")
      await user.click(screen.getByRole('button', { name: 'Back to Be fit' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()
    })

    it('goes back to the Aspirations tab from a goal with no aspiration', async () => {
      const user = await addGoal(async (user) => {
        await user.click(screen.getByRole('button', { name: 'One-off' }))
        await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Paint the fence: both sides')
      })

      expect(await screen.findByRole('heading', { level: 1, name: 'Paint the fence' })).toBeDefined()
      expect(screen.getByRole('status').textContent).toBe("Saved. Add steps when you're ready.")
      await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
    })

    it("shows a building goal's weekly target on its page, and its tasks in Week's bank", async () => {
      const user = await addGoal(async (user) => {
        await user.click(screen.getByRole('button', { name: 'Building' }))
        await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Be strong 2: bench 185')
        await user.type(screen.getByRole('textbox', { name: 'Weekly target (optional)' }), '3')
        await user.type(screen.getByRole('textbox', { name: 'Unit' }), 'lifting sessions')
      })

      const target = await screen.findByRole('region', { name: 'Weekly target' })
      expect(target.textContent).toContain('3 lifting sessions')
      await user.click(screen.getByRole('button', { name: 'Week' }))
      const bank = await screen.findByRole('region', { name: /^Bank/ })
      expect(await within(bank).findAllByText('Be strong 2')).toHaveLength(3)
    })
  })

  it("opens the Goal tab with Be fit selected from Be fit's page", async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'aspiration', aspirationId: 'asp-fit' }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '+ Add a goal for Be fit' }))
    await user.click(screen.getByRole('button', { name: 'Building' }))

    expect(screen.getByRole('button', { name: 'Goal' }).getAttribute('aria-pressed')).toBe('true')
    await screen.findByRole('option', { name: 'Be fit' })
    expect(screen.getByRole('combobox', { name: "What's this for?" })).toHaveProperty('value', 'asp-fit')
  })

  it("adds a recurring item for Be fit from Be fit's page and shows it there", async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'aspiration', aspirationId: 'asp-fit' }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '+ Add recurring' }))
    expect(screen.getByRole('button', { name: 'Recurring' }).getAttribute('aria-pressed')).toBe('true')
    await screen.findByRole('option', { name: 'Be fit' })
    expect(screen.getByRole('combobox', { name: 'Under an aspiration (optional)' })).toHaveProperty('value', 'asp-fit')
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Foam roll')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Day' }), 'Friday')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText("Added. It will show up in the plan when it's next due.")).toBeDefined()
    const recurring = await screen.findByRole('region', { name: 'Recurring' })
    expect(await within(recurring).findByText('Foam roll')).toBeDefined()
    expect(within(recurring).getByText('Every Friday')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))
    expect(await screen.findByText(/recurring: .*Foam roll/)).toBeDefined()
  })

  it('adds a recurring item with no aspiration to Keep life running', async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'upkeep' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Keep life running' })

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Recurring' }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Descale the kettle')
    await user.click(screen.getByRole('button', { name: 'Flexible' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'How often' }), 'Every two weeks')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const main = screen.getByRole('main')
    expect(await within(main).findByText('Descale the kettle')).toBeDefined()
    expect(within(main).getByText('Every two weeks')).toBeDefined()
  })

  it('shows a new aspiration last on the Aspirations tab after Done', async () => {
    localStorage.setItem('gta.screen', JSON.stringify({ screen: 'aspirations' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Aspirations' })

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Aspiration' }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Be generous')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(aspirationCardNames().at(-1)).toBe('Be generous'))
    expect(aspirationCardNames()).toEqual(['Be fit', 'Keep a calm home', 'Be generous'])
  })
})

it('opens Settings from the gear under the Aspirations tab, remembers it, and goes back', async () => {
  const user = userEvent.setup()
  const first = render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Aspirations' }))
  await user.click(await screen.findByRole('button', { name: 'Settings' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()
  expect(currentTab()).toBe('Aspirations')
  first.unmount()

  render(<App />)
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Aspirations' })).toBeDefined()
})
