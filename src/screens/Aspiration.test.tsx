import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore, store } from '../api/mockStore.ts'
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
  const onRetired = vi.fn()
  render(
    <Aspiration
      aspirationId={aspirationId}
      today={TODAY}
      onBack={onBack}
      onOpenGoal={onOpenGoal}
      onRetired={onRetired}
    />,
  )
  return { onBack, onOpenGoal, onRetired }
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

  it('moves down, then back up, turning off the move that no longer applies', async () => {
    const user = userEvent.setup()
    renderPage()
    const priority = await screen.findByRole('region', { name: 'Priority' })
    const up = within(priority).getByRole('button', { name: 'Move up' })
    const down = within(priority).getByRole('button', { name: 'Move down' })

    await user.click(down)

    expect(within(priority).getByText('2nd of 2 aspirations')).toBeDefined()
    expect(within(priority).getByText('Higher ones come first when goals compete for time')).toBeDefined()
    expect(down).toHaveProperty('disabled', true)
    expect(up).toHaveProperty('disabled', false)

    await user.click(up)

    expect(within(priority).getByText('1st of 2 aspirations')).toBeDefined()
    expect(up).toHaveProperty('disabled', true)
  })

  it('edits the name and why in a sheet, pre-filled', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit name and why' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit name and why' })
    const name = within(sheet).getByRole('textbox', { name: 'Name' })
    const why = within(sheet).getByRole('textbox', { name: 'Why' })
    expect(name).toHaveProperty('value', 'Be fit')
    expect(why).toHaveProperty('value', 'So I can keep skiing, biking and playing hockey at a high level for decades.')
    expect(why.getAttribute('placeholder')).toBe('What would this give you?')

    await user.clear(name)
    await user.type(name, 'Be fit for life')
    await user.clear(why)
    await user.type(why, 'To ski at 80.')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Be fit for life' })).toBeDefined()
    expect(screen.getByText('To ski at 80.')).toBeDefined()
  })

  it('removes the why when it is cleared', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit name and why' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit name and why' })
    await user.clear(within(sheet).getByRole('textbox', { name: 'Why' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByText(/^So I can keep skiing/)).toBeNull()
  })

  it("won't save without a name", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit name and why' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit name and why' })
    await user.clear(within(sheet).getByRole('textbox', { name: 'Name' }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Name' }), '   ')

    expect(within(sheet).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
  })

  it('changes nothing on Cancel, and starts fresh the next time', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit name and why' }))
    let sheet = screen.getByRole('dialog', { name: 'Edit name and why' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Name' }), ' and strong')
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Be fit' })).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Edit name and why' }))
    sheet = screen.getByRole('dialog', { name: 'Edit name and why' })
    expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveProperty('value', 'Be fit')
  })

  it('leads the Retire sheet with its history, with Pause them chosen', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Retire' }))

    const sheet = screen.getByRole('dialog', { name: 'Retire Be fit?' })
    expect(within(sheet).getByText('Since October: 1 goal reached, 3 goals active, 2 recurring items.')).toBeDefined()
    const choices = within(sheet).getByRole('group', { name: 'What should happen to its goals and recurring items?' })
    expect(within(choices).getByRole('radio', { name: /^Pause them/ })).toHaveProperty('checked', true)
    expect(within(choices).getByRole('radio', { name: /^Keep them going/ })).toHaveProperty('checked', false)
    expect(within(sheet).getByText('They leave your days. Resume any of them later.')).toBeDefined()
    expect(within(sheet).getByText('They carry on without an aspiration, under Other goals.')).toBeDefined()
    expect(within(sheet).getByText('Be fit moves to Retired, with its history. You can bring it back anytime.')).toBeDefined()
  })

  it('retires with Pause them, pausing its goals, then hands off', async () => {
    const user = userEvent.setup()
    const { onRetired } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Retire' }))
    await user.click(screen.getByRole('button', { name: 'Retire Be fit' }))

    await vi.waitFor(() => expect(onRetired).toHaveBeenCalled())
    expect(store.goals.find((goal) => goal.id === 'goal-strong')?.status).toBe('paused')
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')?.status).toBe('retired')
  })

  it('retires with Keep them going, leaving its goals active with no aspiration', async () => {
    const user = userEvent.setup()
    const { onRetired } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Retire' }))
    await user.click(screen.getByRole('radio', { name: /^Keep them going/ }))
    await user.click(screen.getByRole('button', { name: 'Retire Be fit' }))

    await vi.waitFor(() => expect(onRetired).toHaveBeenCalled())
    const strong = store.goals.find((goal) => goal.id === 'goal-strong')
    expect(strong?.status).toBe('active')
    expect(strong?.aspirationId).toBeUndefined()
  })

  it('changes nothing on Cancel', async () => {
    const user = userEvent.setup()
    const { onRetired } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Retire' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRetired).not.toHaveBeenCalled()
    expect(store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')?.status).toBe('active')
  })

  async function openReview(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Review' }))
    return screen.getByRole('dialog', { name: 'Review Be fit' })
  }

  const lastReviewed = () => store.aspirations.find((aspiration) => aspiration.id === 'asp-fit')?.lastReviewedAt

  it('asks the two review questions, with where it sits', async () => {
    const user = userEvent.setup()
    renderPage()

    const sheet = await openReview(user)

    expect(within(sheet).getByText('Still the right aspiration?')).toBeDefined()
    expect(within(sheet).getByText('Still in the right place?')).toBeDefined()
    expect(within(sheet).getByText('1st of 2 aspirations')).toBeDefined()
    const choices = within(sheet).getByRole('group', { name: 'Review choices' })
    expect(within(choices).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Keep as is',
      'Edit name and why',
      'Move it',
      'Retire',
    ])
  })

  it('closes without recording a review', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(await openReview(user)).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lastReviewed()).toBeUndefined()
  })

  it('records the review and closes on Keep as is', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(await openReview(user)).getByRole('button', { name: 'Keep as is' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await vi.waitFor(() => expect(lastReviewed()).toBe(new Date(2026, 10, 11, 9, 0).toISOString()))
  })

  it('records the review and opens the edit sheet on Edit name and why', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(await openReview(user)).getByRole('button', { name: 'Edit name and why' }))

    expect(screen.getByRole('dialog', { name: 'Edit name and why' })).toBeDefined()
    expect(screen.queryByRole('dialog', { name: 'Review Be fit' })).toBeNull()
    await vi.waitFor(() => expect(lastReviewed()).toBeDefined())
  })

  it('records the review, closes, and goes to Priority on Move it', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(await openReview(user)).getByRole('button', { name: 'Move it' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Priority' }))
    await vi.waitFor(() => expect(lastReviewed()).toBeDefined())
  })

  it('records the review and opens the Retire sheet on Retire', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(within(await openReview(user)).getByRole('button', { name: 'Retire' }))

    expect(screen.getByRole('dialog', { name: 'Retire Be fit?' })).toBeDefined()
    await vi.waitFor(() => expect(lastReviewed()).toBeDefined())
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
