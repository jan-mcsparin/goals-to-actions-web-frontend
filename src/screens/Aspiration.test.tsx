import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore } from '../api/mockStore.ts'
import { Aspiration } from './Aspiration.tsx'

const TODAY = '2026-11-11'

// Wednesday 11 Nov 2026, 9 a.m. local time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPage(aspirationId = 'asp-fit') {
  const onBack = vi.fn()
  const onOpenGoal = vi.fn()
  render(<Aspiration aspirationId={aspirationId} today={TODAY} onBack={onBack} onOpenGoal={onOpenGoal} />)
  return { onBack, onOpenGoal }
}

describe('Aspiration, active', () => {
  it('pins the way back and the "Aspiration" label, then shows the name and why', async () => {
    renderPage()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Be fit' })
    const top = heading.closest('.screen-top') as HTMLElement
    expect(top).not.toBeNull()
    expect(within(top).getByRole('button', { name: 'Back to Aspirations' })).toBeDefined()
    expect(within(top).getByText('Aspiration')).toBeDefined()
    expect(screen.getByText(/^So I can keep skiing/)).toBeDefined()
  })

  it("shows this week's count with days left, and a bar", async () => {
    renderPage()

    const week = await screen.findByRole('region', { name: 'This week' })
    expect(within(week).getByText('2 of 5 · 5 days left')).toBeDefined()
    expect(within(week).getByRole('progressbar')).toHaveProperty('value', 2)
  })

  it('shows a card per active goal with its progress, line and week', async () => {
    renderPage()

    const goals = await screen.findByRole('region', { name: 'Goals' })
    expect(within(goals).getByText('3 active')).toBeDefined()
    const cards = within(goals).getAllByRole('button')
    expect(cards.map((card) => card.querySelector('.goal-card-label')?.textContent)).toEqual([
      'Be strong',
      'Have endurance',
      'Look good',
    ])
    expect(cards[0].textContent).toContain('Milestone 1 of 6')
    expect(cards[0].textContent).toContain('Bench 175, squat 350, deadlift 400')
    expect(cards[0].textContent).toContain('This week: 1 of 3 lifting sessions')
    expect(cards[2].textContent).toContain('No weekly target yet')
  })

  it('opens a goal from its card', async () => {
    const user = userEvent.setup()
    const { onOpenGoal } = renderPage()

    await user.click(await screen.findByRole('button', { name: /^Have endurance/ }))

    expect(onOpenGoal).toHaveBeenCalledWith('goal-endurance')
  })

  it('lists paused goals after the active ones', async () => {
    renderPage('asp-home')

    const goals = await screen.findByRole('region', { name: 'Goals' })
    const cards = within(goals).getAllByRole('button')
    expect(cards.map((card) => card.querySelector('.goal-card-label')?.textContent)).toEqual([
      'Clear out the garage',
      'Cook at home',
    ])
    expect(cards[1].textContent).toContain('Paused')
  })

  it('lists its recurring items with their repeat rule', async () => {
    renderPage()

    const recurring = await screen.findByRole('region', { name: 'Recurring' })
    expect(within(recurring).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'Stretch3 times a week',
      'HockeyEvery Sunday',
    ])
  })

  it('keeps past goals closed until opened, and each opens its goal', async () => {
    const user = userEvent.setup()
    const { onOpenGoal } = renderPage()

    const summary = await screen.findByText('Past goals (1)')
    const details = summary.closest('details')!
    expect(details.open).toBe(false)

    await user.click(summary)
    await user.click(within(details).getByRole('button', { name: /^Run a 5k/ }))

    expect(within(details).getByText('Reached')).toBeDefined()
    expect(onOpenGoal).toHaveBeenCalledWith('goal-5k')
  })

  it('places it in priority, with move up off for the first', async () => {
    renderPage()

    const priority = await screen.findByRole('region', { name: 'Priority' })
    expect(within(priority).getByText('1st of 2 aspirations')).toBeDefined()
    expect(within(priority).getByText('Comes first when goals compete for time')).toBeDefined()
    expect(within(priority).getByRole('button', { name: 'Move up' })).toHaveProperty('disabled', true)
    expect(within(priority).getByRole('button', { name: 'Move down' })).toHaveProperty('disabled', false)
  })

  it('offers Edit name and why, Review and Retire, with no dialog open', async () => {
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'Be fit' })
    for (const name of ['Edit name and why', 'Review', 'Retire']) {
      expect(screen.getByRole('button', { name })).toBeDefined()
    }
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Aspiration, retired', () => {
  it('shows the name, why, when it was retired and its past goals, and only Bring back', async () => {
    renderPage('asp-spanish')

    expect(await screen.findByRole('heading', { level: 1, name: 'Speak Spanish' })).toBeDefined()
    expect(screen.getByText('So I can talk with the family in Valencia.')).toBeDefined()
    expect(screen.getByText('Retired Sep 15')).toBeDefined()
    expect(screen.getByText('Past goals (1)')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Bring back' })).toBeDefined()
    for (const name of ['This week', 'Priority']) expect(screen.queryByRole('region', { name })).toBeNull()
    for (const name of ['Edit name and why', 'Review', 'Retire', 'Move up']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })
})

describe('Aspiration, not there', () => {
  it('goes back quietly', async () => {
    const { onBack } = renderPage('asp-gone')

    await vi.waitFor(() => expect(onBack).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
