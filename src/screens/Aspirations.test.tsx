import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAspirations } from '../api/client.ts'
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
  render(<Aspirations onOpenAspiration={onOpenAspiration} onOpenGoal={onOpenGoal} />)
  return { onOpenAspiration, onOpenGoal }
}

function goalRows(card: HTMLElement) {
  return within(card)
    .getAllByRole('listitem')
    .map((row) => [
      row.querySelector('.goal-row-label')?.textContent,
      row.querySelector('.goal-row-progress')?.textContent,
    ])
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
    vi.mocked(getAspirations).mockImplementationOnce(async () => ({
      aspirations: [{ id: 'asp-new', name: 'Be a builder', priority: 1, status: 'active', createdAt: '2026-11-10T09:00:00Z' }],
      goals: [],
      milestones: [],
      recurringItems: [],
      weeklyTargets: [],
      weekTasks: [],
    }))
    renderTab()

    const card = await screen.findByRole('region', { name: 'Be a builder' })
    expect(within(card).getByText('No goals yet.')).toBeDefined()
    expect(within(card).getByText('No recurring items')).toBeDefined()
  })

  it('says so calmly when loading fails', async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    renderTab()

    expect((await screen.findByRole('status')).textContent).toBe("Couldn't load your aspirations. Try again in a moment.")
  })

  it('never mentions pace or being behind', async () => {
    renderTab()
    await screen.findByRole('region', { name: 'Be fit' })

    expect(document.body.textContent).not.toMatch(/behind|on pace|days? left|more to plan|overdue|late/i)
  })
})
