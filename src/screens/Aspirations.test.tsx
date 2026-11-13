import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAspirations } from '../api/client.ts'
import type { AspirationsOverview } from '../api/types.ts'
import { resetStore } from '../api/mockStore.ts'
import { Aspirations } from './Aspirations.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getAspirations: vi.fn(actual.getAspirations) }
})

// Wednesday 11 Nov 2026, 9 a.m. local time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderTab() {
  const onOpenAspiration = vi.fn()
  const onOpenGoal = vi.fn()
  const onOpenUpkeep = vi.fn()
  const onOpenSettings = vi.fn()
  render(
    <Aspirations
      onOpenAspiration={onOpenAspiration}
      onOpenGoal={onOpenGoal}
      onOpenUpkeep={onOpenUpkeep}
      onOpenSettings={onOpenSettings}
    />,
  )
  return { onOpenAspiration, onOpenGoal, onOpenUpkeep, onOpenSettings }
}

const NOTHING: AspirationsOverview = {
  aspirations: [],
  goals: [],
  milestones: [],
  recurringItems: [],
  weeklyTargets: [],
  weekTasks: [],
}

function goalRows(card: HTMLElement) {
  return within(card)
    .getAllByRole('listitem')
    .map((row) => [
      row.querySelector('.goal-row-label')?.textContent,
      row.querySelector('.goal-row-progress')?.textContent,
    ])
}

// For the tests that wait out a message: timeouts are faked too, and still
// run on their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
}

describe('Aspirations', () => {
  it('pins the heading at the top', async () => {
    renderTab()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Aspirations' })
    expect(heading.closest('.screen-top')).not.toBeNull()
  })

  it('shows a card per active aspiration, in priority order', async () => {
    renderTab()
    await screen.findByRole('region', { name: 'Be fit' })

    const cards = screen.getAllByRole('region').filter((region) => region.classList.contains('aspiration-card'))
    expect(cards.map((card) => card.getAttribute('aria-labelledby'))).toEqual([
      'aspiration-asp-fit',
      'aspiration-asp-home',
    ])
  })

  it("shows an aspiration's why, week, goals and recurring items", async () => {
    renderTab()

    const card = await screen.findByRole('region', { name: 'Be fit' })
    expect(
      within(card).getByText('So I can keep skiing, biking and playing hockey at a high level for decades.'),
    ).toBeDefined()
    expect(within(card).getByText('2 of 5 this week')).toBeDefined()
    const bar = within(card).getByRole('progressbar', { name: 'Be fit, this week' }) as HTMLProgressElement
    expect([bar.value, bar.max]).toEqual([2, 5])
    expect(goalRows(card)).toEqual([
      ['Be strong', 'Milestone 1 of 6'],
      ['Have endurance', 'Milestone 2 of 4'],
      ['Look good', 'Milestone 0 of 3'],
    ])
    expect(within(card).getByText('2 recurring: Stretch, Hockey')).toBeDefined()
  })

  it('leaves out the why and the week when there are none, and says Step for a one-off goal', async () => {
    renderTab()

    const card = await screen.findByRole('region', { name: 'Keep a calm home' })
    expect(within(card).queryByRole('progressbar')).toBeNull()
    expect(within(card).queryByText(/this week/)).toBeNull()
    expect(within(card).getByRole('button', { name: 'Keep a calm home' }).getAttribute('aria-describedby')).toBeNull()
    expect(goalRows(card)).toEqual([
      ['Clear out the garage', 'Step 3 of 6 · by Dec 4'],
      ['Cook at home', 'Paused'],
    ])
    expect(within(card).getByText('2 recurring: Take out the trash, Laundry')).toBeDefined()
  })

  it('opens the aspiration from the card top and the goal from a goal row', async () => {
    const user = userEvent.setup()
    const { onOpenAspiration, onOpenGoal } = renderTab()
    const card = await screen.findByRole('region', { name: 'Be fit' })

    await user.click(within(card).getByRole('button', { name: 'Be fit' }))
    expect(onOpenAspiration).toHaveBeenCalledExactlyOnceWith('asp-fit')
    expect(onOpenGoal).not.toHaveBeenCalled()

    await user.click(within(card).getByRole('button', { name: /^Have endurance/ }))
    expect(onOpenGoal).toHaveBeenCalledExactlyOnceWith('goal-endurance')
    expect(onOpenAspiration).toHaveBeenCalledOnce()
  })

  it('says "No goals yet." on a card with no goals', async () => {
    vi.mocked(getAspirations).mockResolvedValueOnce({
      ...NOTHING,
      aspirations: [{ id: 'asp-new', name: 'Be a builder', priority: 1, status: 'active', createdAt: '2026-11-10T09:00:00Z' }],
    })
    renderTab()

    const card = await screen.findByRole('region', { name: 'Be a builder' })
    expect(within(card).getByText('No goals yet.')).toBeDefined()
    expect(within(card).getByText('No recurring items')).toBeDefined()
  })

  it('says so calmly when loading fails', async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    renderTab()

    const message = await screen.findByRole('status')
    expect(message.className).toBe('screen-message')
    expect(message.textContent).toBe("Couldn't load your aspirations. Try again in a moment.")
  })

  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderTab()

    const message = await screen.findByRole('button', { name: "Couldn't load your aspirations. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('never mentions pace or being behind', async () => {
    renderTab()
    await screen.findByRole('region', { name: 'Be fit' })

    expect(document.body.textContent).not.toMatch(/behind|on pace|days? left|more to plan|overdue|late/i)
  })

  describe('below the cards', () => {
    it('lists goals with no aspiration under Other goals, with past goals closed', async () => {
      const user = userEvent.setup()
      const { onOpenGoal } = renderTab()

      const other = await screen.findByRole('region', { name: 'Other goals' })
      const past = within(other).getByRole('group') as HTMLDetailsElement
      expect(within(other).getByRole('button', { name: /^Renew my passport/ }).textContent).toContain(
        'Step 0 of 1 · by Dec 19',
      )
      expect(past.querySelector('summary')?.textContent).toBe('Past goals (1)')
      expect(past.open).toBe(false)
      expect(within(past).getByText('File my taxes')).toBeDefined()

      await user.click(within(other).getByRole('button', { name: /^Renew my passport/ }))
      expect(onOpenGoal).toHaveBeenCalledExactlyOnceWith('goal-passport')
    })

    it('leaves Other goals out when every goal has an aspiration', async () => {
      const actual = await getAspirations()
      vi.mocked(getAspirations).mockResolvedValueOnce({
        ...actual,
        goals: actual.goals.filter((goal) => goal.aspirationId),
      })
      renderTab()
      await screen.findByRole('region', { name: 'Be fit' })

      expect(screen.queryByRole('region', { name: 'Other goals' })).toBeNull()
    })

    it('always shows the Keep life running row, which opens its page', async () => {
      const user = userEvent.setup()
      const { onOpenUpkeep } = renderTab()

      const row = await screen.findByRole('button', { name: /^Keep life running/ })
      expect(row.textContent).toContain('1 recurring')

      await user.click(row)
      expect(onOpenUpkeep).toHaveBeenCalledOnce()
    })

    it('keeps retired aspirations closed at first; each opens its page', async () => {
      const user = userEvent.setup()
      const { onOpenAspiration } = renderTab()
      await screen.findByRole('region', { name: 'Be fit' })

      const retired = screen.getByText('Retired (1)').closest('details')!
      expect(retired.open).toBe(false)

      await user.click(within(retired).getByRole('button', { name: 'Speak Spanish' }))
      expect(onOpenAspiration).toHaveBeenCalledExactlyOnceWith('asp-spanish')
    })

    it('explains the order under the cards', async () => {
      renderTab()

      expect(
        await screen.findByText('In order of priority. The first comes first when goals compete for time. Add one with +.'),
      ).toBeDefined()
    })

    it('invites a first sentence when nothing is set up, with Keep life running still there', async () => {
      vi.mocked(getAspirations).mockResolvedValueOnce(NOTHING)
      renderTab()

      expect(
        await screen.findByText('Nothing here yet. Start with one sentence: a goal, or who you want to be.'),
      ).toBeDefined()
      expect(screen.getByRole('button', { name: /^Keep life running/ }).textContent).toContain('No recurring items')
      expect(screen.queryByText(/In order of priority/)).toBeNull()
      expect(screen.queryByText(/^Retired/)).toBeNull()
    })
  })
})

describe('the gear', () => {
  it('sits in the header and opens Settings', async () => {
    const user = userEvent.setup()
    const { onOpenSettings } = renderTab()

    const top = screen.getByRole('heading', { level: 1, name: 'Aspirations' }).closest('.screen-top') as HTMLElement
    const gear = within(top).getByRole('button', { name: 'Settings' })
    await user.click(gear)

    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
