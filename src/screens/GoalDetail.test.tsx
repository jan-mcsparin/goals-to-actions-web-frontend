import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore } from '../api/mockStore.ts'
import type { GoalOrigin } from '../hooks/useNavigation.ts'
import { GoalDetail } from './GoalDetail.tsx'

const TODAY = '2026-11-11'

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

function renderGoal(goalId = 'goal-strong', from: GoalOrigin = { screen: 'aspiration', aspirationId: 'asp-fit' }) {
  const onBack = vi.fn()
  const onOpenAspiration = vi.fn()
  const onNotFound = vi.fn()
  const view = render(
    <GoalDetail
      goalId={goalId}
      from={from}
      today={TODAY}
      onBack={onBack}
      onOpenAspiration={onOpenAspiration}
      onNotFound={onNotFound}
    />,
  )
  return { ...view, onBack, onOpenAspiration, onNotFound }
}

async function timeline() {
  return screen.findByRole('region', { name: 'Milestones' })
}

describe('GoalDetail, header', () => {
  it('pins back, the type, the label, the measurable line and the aspiration link', async () => {
    const user = userEvent.setup()
    const { onBack, onOpenAspiration } = renderGoal()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Be strong' })
    const top = heading.closest('.screen-top') as HTMLElement
    expect(within(top).getByText('Building')).toBeDefined()
    expect(within(top).getByText('Bench 175, squat 350, deadlift 400')).toBeDefined()

    await user.click(within(top).getByRole('button', { name: 'Back to Be fit' }))
    expect(onBack).toHaveBeenCalled()

    await user.click(within(top).getByRole('button', { name: 'Be fit ›' }))
    expect(onOpenAspiration).toHaveBeenCalledWith('asp-fit')
  })

  it('names back for the tab when opened from there', async () => {
    renderGoal('goal-strong', { screen: 'aspirations' })

    expect(await screen.findByRole('button', { name: 'Back to Aspirations' })).toBeDefined()
  })

  it('marks a paused goal, and has no link for a goal with no aspiration', async () => {
    const paused = renderGoal('goal-cook')
    expect(await screen.findByText('Building · Paused')).toBeDefined()
    paused.unmount()

    renderGoal('goal-passport', { screen: 'aspirations' })
    await screen.findByRole('heading', { level: 1, name: 'Renew my passport' })
    expect(screen.getByText('One-off')).toBeDefined()
    expect(screen.queryByRole('button', { name: /›$/ })).toBeNull()
  })

  it('goes back quietly when the goal isn’t there', async () => {
    const { onNotFound } = renderGoal('goal-gone')

    await vi.waitFor(() => expect(onNotFound).toHaveBeenCalled())
  })
})

describe('GoalDetail, where you started', () => {
  it('shows the baseline and the latest result', async () => {
    renderGoal()

    expect(await screen.findByText('Started at: Bench 145, squat 275, deadlift 315')).toBeDefined()
    expect(screen.getByText('Latest: Bench 152, squat 300, deadlift 340 · Nov 6')).toBeDefined()
  })
})

describe('GoalDetail, timeline', () => {
  it('opens condensed: the latest hit, the not-yet Next, a fold and the goal', async () => {
    renderGoal()

    const section = await timeline()
    expect(within(section).getByText('1 of 6 hit')).toBeDefined()
    expect(within(section).getByText('Start')).toBeDefined()
    expect(within(section).getByText('Bench 150, squat 285, deadlift 325')).toBeDefined()
    const next = within(section).getByText('Bench 155, squat 300, deadlift 345').closest('li') as HTMLElement
    expect(within(next).getByText('Next')).toBeDefined()
    expect(within(next).getByText(/^Not yet/)).toBeDefined()
    expect(within(section).getByRole('button', { name: '3 more: Wk 9, No date, No date' })).toBeDefined()
    expect(within(section).queryByText('Bench 165, squat 325, deadlift 370')).toBeNull()
    expect(within(section).getByText('Bench 175, squat 350, deadlift 400')).toBeDefined()
  })

  it('expands from a fold row or Show all, collapses with Show less, and remembers', async () => {
    const user = userEvent.setup()
    const first = renderGoal()

    await user.click(within(await timeline()).getByRole('button', { name: '3 more: Wk 9, No date, No date' }))
    expect(screen.getByText('Bench 165, squat 325, deadlift 370')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.queryByText('Bench 165, squat 325, deadlift 370')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Show all 6' }))
    expect(screen.getByText('Bench 165, squat 325, deadlift 370')).toBeDefined()
    first.unmount()

    renderGoal()
    expect(await screen.findByText('Bench 165, squat 325, deadlift 370')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeDefined()
  })

  it('shows every row and no toggle with four milestones or fewer', async () => {
    renderGoal('goal-endurance')

    const section = await timeline()
    expect(within(section).getByText('Run 10k in under 55 minutes')).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Show / })).toBeNull()
  })

  it('calls a one-off goal’s milestones Steps', async () => {
    renderGoal('goal-garage', { screen: 'aspirations' })

    const section = await screen.findByRole('region', { name: 'Steps' })
    expect(within(section).getByText('3 of 6 done')).toBeDefined()
  })
})

describe('GoalDetail, target and next check-in', () => {
  it('shows the weekly target and when Next is due', async () => {
    renderGoal()

    const target = await screen.findByRole('region', { name: 'Weekly target' })
    expect(within(target).getByText('3 lifting sessions')).toBeDefined()
    const checkIn = screen.getByRole('region', { name: 'Next check-in' })
    expect(within(checkIn).getByText('Bench 155, squat 300, deadlift 345')).toBeDefined()
    expect(within(checkIn).getByText('Wk 5 · Nov 6')).toBeDefined()
  })

  it('says when there’s no target yet, and a one-off goal shows its deadline', async () => {
    const paused = renderGoal('goal-look-good')
    expect(await screen.findByText('No weekly target yet')).toBeDefined()
    paused.unmount()

    renderGoal('goal-garage', { screen: 'aspirations' })
    expect(await screen.findByText('Deadline: Dec 4')).toBeDefined()
  })

  it('says whenever you choose for an undated Next', async () => {
    renderGoal('goal-endurance')

    const checkIn = await screen.findByRole('region', { name: 'Next check-in' })
    expect(within(checkIn).getByText('Whenever you choose')).toBeDefined()
  })
})

describe('GoalDetail, reached', () => {
  it('reads Reached with the date and what’s next, and no check-in', async () => {
    renderGoal('goal-5k')

    expect(await screen.findByText('Reached Oct 10')).toBeDefined()
    expect(screen.getByText('What’s next for Be fit?')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Next check-in' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
