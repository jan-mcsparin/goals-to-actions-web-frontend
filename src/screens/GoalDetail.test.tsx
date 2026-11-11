import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGoal, setWeeklyTarget } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { GoalOrigin } from '../hooks/useNavigation.ts'
import { GoalDetail } from './GoalDetail.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getGoal: vi.fn(actual.getGoal), setWeeklyTarget: vi.fn(actual.setWeeklyTarget) }
})

const TODAY = '2026-11-11'

// For the tests that wait out a message: timeouts are faked too, and still
// run on their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
}

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

describe('GoalDetail, weekly target sheet', () => {
  it('opens only from a tap, pre-filled, and shows the new target at once', async () => {
    const user = userEvent.setup()
    renderGoal()

    const target = await screen.findByRole('region', { name: 'Weekly target' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(within(target).getByRole('button', { name: 'Edit weekly target' }))

    const sheet = screen.getByRole('dialog', { name: 'Weekly target' })
    const amount = within(sheet).getByRole('textbox', { name: 'Amount' })
    expect(amount).toHaveProperty('value', '3')
    expect(within(sheet).getByRole('textbox', { name: 'Unit' })).toHaveProperty('value', 'lifting sessions')
    await user.clear(amount)
    await user.type(amount, '4')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(target).getByText('4 lifting sessions')).toBeDefined()
  })

  it('sets a first target, saving only a whole number and a unit', async () => {
    const user = userEvent.setup()
    renderGoal('goal-look-good')

    await user.click(await screen.findByRole('button', { name: 'Set weekly target' }))
    const sheet = screen.getByRole('dialog', { name: 'Weekly target' })
    const save = within(sheet).getByRole('button', { name: 'Save' })
    expect(save).toHaveProperty('disabled', true)

    await user.type(within(sheet).getByRole('textbox', { name: 'Amount' }), '2.5')
    await user.type(within(sheet).getByRole('textbox', { name: 'Unit' }), 'clean meals')
    expect(save).toHaveProperty('disabled', true)

    await user.clear(within(sheet).getByRole('textbox', { name: 'Amount' }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Amount' }), '2')
    await user.click(save)

    expect(await screen.findByText('2 clean meals')).toBeDefined()
  })

  it('keeps the target as it was on Cancel', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'Edit weekly target' }))
    const sheet = screen.getByRole('dialog', { name: 'Weekly target' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Amount' }), '0')
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('3 lifting sessions')).toBeDefined()
  })
})

describe('GoalDetail, add milestone sheet', () => {
  it('adds a milestone last and counts it', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: '+ Add milestone' }))
    const sheet = screen.getByRole('dialog', { name: 'Add milestone' })
    expect(within(sheet).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    await user.type(within(sheet).getByRole('textbox', { name: 'Measurable line' }), 'Bench 172, squat 345, deadlift 395')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(await timeline()).getByText('1 of 7 hit')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Show all 7' }))
    expect(screen.getByText('Bench 172, squat 345, deadlift 395')).toBeDefined()
  })

  it('says step on a one-off goal, with dates from the start to the deadline', async () => {
    const user = userEvent.setup()
    renderGoal('goal-garage', { screen: 'aspirations' })

    await user.click(await screen.findByRole('button', { name: '+ Add step' }))
    const date = within(screen.getByRole('dialog', { name: 'Add step' })).getByLabelText('Date (optional)')
    expect(date).toHaveProperty('min', '2026-11-02')
    expect(date).toHaveProperty('max', '2026-12-04')
  })

  it('offers no adding on a reached goal', async () => {
    renderGoal('goal-5k')

    await screen.findByText('Reached Oct 10')
    expect(screen.queryByRole('button', { name: '+ Add milestone' })).toBeNull()
  })
})

describe('GoalDetail, the not-yet card', () => {
  async function notYetCard() {
    return screen.findByRole('region', { name: 'Not yet' })
  }

  it('shows for the mock’s not-yet milestone, leading with the baseline, then its result', async () => {
    renderGoal()

    const card = await notYetCard()
    expect(within(card).getByText('Bench 155, squat 300, deadlift 345')).toBeDefined()
    expect(
      within(card).getByText(
        'You started at bench 145, squat 275, deadlift 315. Now: bench 152, squat 300, deadlift 340.',
      ),
    ).toBeDefined()
  })

  it('keep the date: the card goes and the milestone stays Next', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(within(await notYetCard()).getByRole('button', { name: 'Keep the date' }))

    expect(screen.queryByRole('region', { name: 'Not yet' })).toBeNull()
    const checkIn = screen.getByRole('region', { name: 'Next check-in' })
    expect(within(checkIn).getByText('Bench 155, squat 300, deadlift 345')).toBeDefined()
  })

  it('move the date: the card goes and the next milestone moves by as much', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(within(await notYetCard()).getByRole('button', { name: 'Move the date' }))
    const sheet = screen.getByRole('dialog', { name: 'Move the date' })
    const date = within(sheet).getByLabelText('New date')
    expect(date).toHaveProperty('value', '2026-11-06')
    fireEvent.change(date, { target: { value: '2026-11-27' } })
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('region', { name: 'Not yet' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show all 6' }))
    const third = screen.getByText('Bench 160, squat 310, deadlift 355').closest('li') as HTMLElement
    expect(within(third).getByText('Wk 12 · Dec 21')).toBeDefined()
  })

  it('adjust the milestone: a new line, and the card goes', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(within(await notYetCard()).getByRole('button', { name: 'Adjust the milestone' }))
    const sheet = screen.getByRole('dialog', { name: 'Adjust the milestone' })
    const line = within(sheet).getByRole('textbox', { name: 'Measurable line' })
    await user.clear(line)
    await user.type(line, 'Bench 153, squat 300, deadlift 345')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('region', { name: 'Not yet' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Next check-in' })).getByText('Bench 153, squat 300, deadlift 345')).toBeDefined()
  })
})

describe('GoalDetail, checking in', () => {
  it('opens only from a tap, titled with the milestone, and a hit moves Next on', async () => {
    const user = userEvent.setup()
    renderGoal()

    const checkIn = await screen.findByRole('region', { name: 'Next check-in' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(within(checkIn).getByRole('button', { name: 'Check in' }))
    const sheet = screen.getByRole('dialog', { name: 'Bench 155, squat 300, deadlift 345' })
    expect(within(sheet).getByText('How did it go?')).toBeDefined()
    // The result is optional, so the keyboard waits for a tap on it.
    expect(document.activeElement).toBe(within(sheet).getByRole('heading', { name: 'Bench 155, squat 300, deadlift 345' }))
    const result = within(sheet).getByRole('textbox', { name: 'Result (optional)' })
    expect(result.getAttribute('placeholder')).toBeNull()
    await user.type(result, 'Bench 155, squat 305, deadlift 350')
    await user.click(within(sheet).getByRole('button', { name: 'Hit it' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(checkIn).getByText('Milestone hit: Bench 155, squat 300, deadlift 345')).toBeDefined()
    expect(within(checkIn).getByText('Bench 160, squat 310, deadlift 355')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Not yet' })).toBeNull()
    expect(screen.getByText('Latest: Bench 155, squat 305, deadlift 350 · Nov 11')).toBeDefined()
  })

  it('a not yet brings up the card', async () => {
    const user = userEvent.setup()
    renderGoal('goal-endurance')

    await user.click(within(await screen.findByRole('region', { name: 'Next check-in' })).getByRole('button', { name: 'Check in' }))
    const sheet = screen.getByRole('dialog', { name: 'Run 10k in under 55 minutes' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Result (optional)' }), '10k in 57 minutes')
    await user.click(within(sheet).getByRole('button', { name: 'Not yet' }))

    const card = screen.getByRole('region', { name: 'Not yet' })
    expect(within(card).getByText('You started at 5k in 31 minutes. Now: 10k in 57 minutes.')).toBeDefined()
  })

  it('with every milestone hit, hitting the goal itself marks it reached', async () => {
    const user = userEvent.setup()
    renderGoal('goal-look-good')

    for (const line of ['Body fat at 19%', 'Body fat at 17%']) {
      const checkIn = await screen.findByRole('region', { name: 'Next check-in' })
      await user.click(within(checkIn).getByRole('button', { name: 'Check in' }))
      await user.click(within(screen.getByRole('dialog', { name: line })).getByRole('button', { name: 'Hit it' }))
    }
    const checkIn = screen.getByRole('region', { name: 'Next check-in' })
    expect(within(checkIn).getByText('Body fat at 15%')).toBeDefined()
    await user.click(within(checkIn).getByRole('button', { name: 'Check in' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Body fat at 15%' })).getByRole('button', { name: 'Hit it' }))

    expect(await screen.findByText('Reached Nov 11')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Next check-in' })).toBeNull()
  })

  it('a one-off goal’s later step can be done first, from its row', async () => {
    const user = userEvent.setup()
    renderGoal('goal-garage', { screen: 'aspirations' })

    await user.click(await screen.findByRole('button', { name: /^Put up the shelves/ }))
    const sheet = screen.getByRole('dialog', { name: 'Put up the shelves' })
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))

    expect(within(screen.getByRole('region', { name: 'Steps' })).getByText('4 of 6 done')).toBeDefined()
    expect(screen.getByText('Step done: Put up the shelves')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Next check-in' })).getByText('Donate and dump the rest')).toBeDefined()
  })

  it('never uses words of judgment', async () => {
    const user = userEvent.setup()
    renderGoal()

    await screen.findByRole('region', { name: 'Not yet' })
    await user.click(screen.getByRole('button', { name: 'Show all 6' }))
    expect(document.body.textContent).not.toMatch(/missed|failed|behind|overdue/i)
  })
})

describe('GoalDetail, pause and end', () => {
  it('pauses and resumes from the actions', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(await screen.findByText('Building · Paused')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await screen.findByText('Building')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined()
  })

  it('ends as reached from a sheet that leads with what was achieved', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'End goal' }))
    const sheet = screen.getByRole('dialog', { name: 'End goal' })
    expect(within(sheet).getByText('Started at: Bench 145, squat 275, deadlift 315')).toBeDefined()
    expect(within(sheet).getByText('Latest: Bench 152, squat 300, deadlift 340 · Nov 6')).toBeDefined()
    expect(within(sheet).getByText('1 of 6 milestones hit')).toBeDefined()
    await user.click(within(sheet).getByRole('button', { name: 'I reached it' }))

    expect(await screen.findByText('Reached Nov 11')).toBeDefined()
    expect(screen.getByText('What’s next for Be fit?')).toBeDefined()
    for (const name of ['Pause', 'End goal', 'Check in', '+ Add milestone']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(within(screen.getByRole('region', { name: 'Milestones' })).getByText('6 of 6 hit')).toBeDefined()
  })

  it('reopens a goal reached by mistake, as it was', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'End goal' }))
    await user.click(within(screen.getByRole('dialog', { name: 'End goal' })).getByRole('button', { name: 'I reached it' }))
    await user.click(await screen.findByRole('button', { name: 'Reopen' }))

    expect(await screen.findByRole('button', { name: 'Check in' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Not yet' })).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Milestones' })).getByText('1 of 6 hit')).toBeDefined()
  })

  it('ends for now, reading Not yet with what was achieved, and goes again', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'End goal' }))
    await user.click(within(screen.getByRole('dialog', { name: 'End goal' })).getByRole('button', { name: 'End it for now' }))

    expect(await screen.findByText('Not yet.')).toBeDefined()
    expect(screen.getByText('1 of 6 milestones hit')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/missed|failed|behind|overdue/i)

    await user.click(screen.getByRole('button', { name: 'Go again' }))
    expect(await screen.findByRole('button', { name: 'Check in' })).toBeDefined()
  })

  it('cancel leaves the goal as it was', async () => {
    const user = userEvent.setup()
    renderGoal()

    await user.click(await screen.findByRole('button', { name: 'End goal' }))
    await user.click(within(screen.getByRole('dialog', { name: 'End goal' })).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined()
  })
})

describe('GoalDetail, a failed load or save', () => {
  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getGoal).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGoal()

    const message = await screen.findByRole('button', { name: "Couldn't load this goal. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says so above the tab bar, and lets it go after a few seconds', async () => {
    fakeTimeouts()
    vi.mocked(setWeeklyTarget).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGoal()

    const target = await screen.findByRole('region', { name: 'Weekly target' })
    await user.click(within(target).getByRole('button', { name: 'Edit weekly target' }))
    const sheet = screen.getByRole('dialog', { name: 'Weekly target' })
    await user.clear(within(sheet).getByRole('textbox', { name: 'Amount' }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Amount' }), '4')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    const message = await screen.findByRole('status')
    expect(message.className).toBe('screen-message')
    expect(message.textContent).toBe("Couldn't save that. Try again.")

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
