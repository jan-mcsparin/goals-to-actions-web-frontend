import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  answerQuitDay,
  answerStillMatters,
  checkOffTask,
  clearQuitDay,
  clearUrgeRating,
  createGoal,
  deleteTask,
  getWeek,
  placeTask,
  rateUrge,
  wrapUpWeek,
} from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Day } from './Day.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    checkOffTask: vi.fn(actual.checkOffTask),
    getWeek: vi.fn(actual.getWeek),
    placeTask: vi.fn(actual.placeTask),
    moveTaskToBank: vi.fn(actual.moveTaskToBank),
    swapTasks: vi.fn(actual.swapTasks),
    deleteTask: vi.fn(actual.deleteTask),
    answerStillMatters: vi.fn(actual.answerStillMatters),
    answerQuitDay: vi.fn(actual.answerQuitDay),
    clearQuitDay: vi.fn(actual.clearQuitDay),
    rateUrge: vi.fn(actual.rateUrge),
    clearUrgeRating: vi.fn(actual.clearUrgeRating),
  }
})

// Wednesday 11 Nov 2026, 9 a.m. local time. Only Date is faked, so RTL's
// polling timers still run.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)
const WEDNESDAY_DAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY)
  resetStore()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// For the tests that wait out a message: timeouts are faked too, and still
// run on their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  vi.setSystemTime(WEDNESDAY)
}

function rowTitles(group: HTMLElement) {
  return within(group)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.task-title')?.textContent)
}

describe('Day', () => {
  it("shows today's plan in groups, in day order, with progress", async () => {
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Today · Wednesday' })).toBeDefined()
    expect(screen.getByText('0 of 4 done')).toBeDefined()

    const keep = screen.getByRole('region', { name: 'Keep life running' })
    expect(rowTitles(keep)).toEqual(['Move the car for street sweeping', 'Fill out my ballot'])
    expect(within(keep).getByText('by 7 a.m.')).toBeDefined()

    const forward = screen.getByRole('region', { name: 'Move forward' })
    expect(rowTitles(forward)).toEqual(['Lift: bench day', 'Laundry'])
    expect(within(forward).getByText('at 6 p.m.')).toBeDefined()
    expect(within(forward).getByText('Be strong · Be fit')).toBeDefined()
    expect(within(forward).getByText('Keep a calm home')).toBeDefined()

    const freeTime = screen.getByRole('region', { name: 'Free time' })
    expect(within(freeTime).getByText('The rest is yours.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pull from bank' })).toBeDefined()
  })

  it('marks a task done with one tap and undoes it with another', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const laundry = await screen.findByRole('checkbox', { name: 'Laundry' })

    await user.click(laundry)

    expect(laundry.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('1 of 4 done')).toBeDefined()

    await user.click(laundry)

    expect(laundry.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('0 of 4 done')).toBeDefined()
  })

  it('says a failed save above the tab bar, and lets it go after a few seconds', async () => {
    fakeTimeouts()
    // Still matter? is the one save on Today that isn't queued.
    vi.mocked(answerStillMatters).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    const card = await screen.findByRole('group', { name: 'Still matter? Call the dentist' })
    await user.click(within(card).getByRole('button', { name: 'Keep' }))

    const message = await screen.findByRole('status')
    expect(message.className).toBe('screen-message')
    expect(message.textContent).toBe("Couldn't save that. Try again.")

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says quietly how many changes wait once a send has failed, and only then', async () => {
    vi.mocked(checkOffTask).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    expect(await screen.findByRole('checkbox', { name: 'Laundry' })).toBeDefined()
    expect(screen.queryByText(/waiting to send/)).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'Laundry' }))

    expect(await screen.findByText('1 change waiting to send')).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()
    vi.mocked(checkOffTask).mockReset()
  })

  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    const message = await screen.findByRole('button', { name: "Couldn't load today. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("still shows the day's heading when it can't load", async () => {
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await screen.findByRole('status')
    const heading = screen.getByRole('heading', { level: 1, name: 'Today · Wednesday' })
    expect(heading.closest('.screen-top')).not.toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('still shows an opened day with its way back when it can\'t load', async () => {
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    render(<Day date="2026-11-12" today={WEDNESDAY_DAY} onBack={() => {}} />)

    await screen.findByRole('status')
    expect(screen.getByRole('heading', { level: 1, name: 'Thursday · Nov 12' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Back to This week' })).toBeDefined()
  })

  it('switches to goal cards and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'By goal' }))

    expect(screen.getByRole('button', { name: 'By goal' }).getAttribute('aria-pressed')).toBe('true')
    const card = screen.getByRole('region', { name: 'Be strong · Be fit' })
    expect(rowTitles(card)).toEqual(['Lift: bench day'])
    expect(within(card).queryByText('Be strong · Be fit', { selector: '.task-subline' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Keep life running' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Move forward' })).toBeNull()
    expect(within(card).getByRole('progressbar', { name: 'Be strong · Be fit done today' })).toBeDefined()
    const upkeep = screen.getByRole('region', { name: 'Keep life running' })
    expect(within(upkeep).getByRole('progressbar', { name: 'Keep life running done today' })).toBeDefined()

    unmount()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect((await screen.findByRole('button', { name: 'By goal' })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('shows only the day bar in List', async () => {
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await screen.findByRole('region', { name: 'Move forward' })
    expect(screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-label'))).toEqual(['Done today'])
  })

  it('pulls a task from the bank onto today', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(4)

    await user.click(within(sheet).getByRole('button', { name: 'Lift: deadlift day' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rowTitles(screen.getByRole('region', { name: 'Move forward' }))).toEqual([
      'Lift: bench day',
      'Laundry',
      'Lift: deadlift day',
    ])
    expect(screen.getByText('0 of 5 done')).toBeDefined()
    expect(placeTask).toHaveBeenCalledWith('task-lift-bank', '2026-11-09', WEDNESDAY_DAY)
  })

  it('says so when the bank is empty, and closes', async () => {
    const week = await getWeek('2026-11-09')
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => task.plannedDay !== null) })
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(await within(sheet).findByText('Nothing in the bank.')).toBeDefined()

    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the bank on a tap off it, leaving today as it was', async () => {
    vi.mocked(placeTask).mockClear()
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })

    // Outside the sheet's box, which jsdom leaves at 0 × 0.
    fireEvent.mouseDown(sheet, { clientX: 200, clientY: 100 })
    fireEvent.click(sheet, { clientX: 200, clientY: 100 })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('0 of 4 done')).toBeDefined()
    expect(placeTask).not.toHaveBeenCalled()
  })

  it('sends a task back to the bank from its menu', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'More for Laundry' }))
    await user.click(screen.getByRole('button', { name: 'Back to bank' }))

    expect(screen.queryByRole('checkbox', { name: 'Laundry' })).toBeNull()
    expect(screen.getByText('0 of 3 done')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(await within(sheet).findByRole('button', { name: 'Laundry' })).toBeDefined()
  })

  it('swaps a task for one from the bank', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'More for Laundry' }))
    await user.click(screen.getByRole('button', { name: 'Swap' }))
    const sheet = await screen.findByRole('dialog', { name: 'Swap Laundry for' })
    await user.click(await within(sheet).findByRole('button', { name: 'Call the dentist' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    // In the swapped task's place until sent; then in the order the week read gives.
    expect([...rowTitles(screen.getByRole('region', { name: 'Keep life running' }))].sort()).toEqual([
      'Call the dentist',
      'Fill out my ballot',
      'Move the car for street sweeping',
    ])
    expect(screen.getByText('0 of 4 done')).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Call the dentist' }))
  })

  it('closes a row menu with the first tap elsewhere, without checking anything off', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const ballot = await screen.findByRole('checkbox', { name: 'Fill out my ballot' })

    await user.click(screen.getByRole('button', { name: 'More for Laundry' }))
    await user.click(ballot)

    expect(screen.queryByRole('button', { name: 'Back to bank' })).toBeNull()
    expect(ballot.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('0 of 4 done')).toBeDefined()

    await user.click(ballot)

    expect(ballot.getAttribute('aria-checked')).toBe('true')
  })

  it("closes an open menu with a tap on another row's menu, without opening that one", async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const ballotMenu = await screen.findByRole('button', { name: 'More for Fill out my ballot' })

    await user.click(screen.getByRole('button', { name: 'More for Laundry' }))
    await user.click(ballotMenu)

    expect(screen.queryByRole('button', { name: 'Back to bank' })).toBeNull()
    expect(ballotMenu.getAttribute('aria-expanded')).toBe('false')

    await user.click(ballotMenu)

    expect(ballotMenu.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not swallow a later tap when the closing touch turned into a scroll', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const ballot = await screen.findByRole('checkbox', { name: 'Fill out my ballot' })
    await user.click(screen.getByRole('button', { name: 'More for Laundry' }))

    fireEvent.pointerDown(document.body)
    fireEvent.pointerCancel(document.body)
    await user.click(ballot)

    expect(ballot.getAttribute('aria-checked')).toBe('true')
  })

  it("shows a swapped-in goal task's goal and aspiration", async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'More for Laundry' }))
    await user.click(screen.getByRole('button', { name: 'Swap' }))
    const sheet = await screen.findByRole('dialog', { name: 'Swap Laundry for' })
    await user.click(await within(sheet).findByRole('button', { name: 'Sort the garage shelves' }))

    const forward = screen.getByRole('region', { name: 'Move forward' })
    expect(within(forward).getByText('Clear out the garage · Keep a calm home')).toBeDefined()
  })

  it('offers no menu on a done task, since a tap undoes it', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('checkbox', { name: 'Laundry' }))

    expect(screen.queryByRole('button', { name: 'More for Laundry' })).toBeNull()
  })

  // The bank is drawn from the day's week (ADR-010), so the sheet has no load of its own.
  it('opens the bank from the week already read, with no second read', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await screen.findByRole('button', { name: 'Pull from bank' })
    vi.mocked(getWeek).mockClear()

    await user.click(screen.getByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })

    expect(within(sheet).getByRole('button', { name: 'Lift: deadlift day' })).toBeDefined()
    expect(within(sheet).queryByText('Loading…')).toBeNull()
    expect(getWeek).not.toHaveBeenCalled()
  })

  it('shows another day with its own heading, and pulls bank tasks onto it', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-13" today={WEDNESDAY_DAY} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Friday · Nov 13' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    await user.click(await within(sheet).findByRole('button', { name: 'Lift: deadlift day' }))

    expect(screen.getByRole('checkbox', { name: 'Lift: deadlift day' })).toBeDefined()
    expect(placeTask).toHaveBeenCalledWith('task-lift-bank', '2026-11-09', '2026-11-13')
  })

  it('lets you check off a task on another day', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

    const trash = await screen.findByRole('checkbox', { name: 'Take out the trash' })
    await user.click(trash)

    expect(trash.getAttribute('aria-checked')).toBe('true')
  })

  it('keeps fixed-day items in place: their menu only deletes, and they can still be checked off', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

    const trash = await screen.findByRole('checkbox', { name: 'Take out the trash' })
    await user.click(screen.getByRole('button', { name: 'More for Take out the trash' }))
    expect(screen.queryByRole('button', { name: 'Back to bank' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete (made by mistake)' })).toBeDefined()
    await user.keyboard('{Escape}')
    await user.click(trash)
    expect(trash.getAttribute('aria-checked')).toBe('true')
  })

  it("doesn't offer to place tasks on a past day", async () => {
    render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

    await screen.findByRole('heading', { level: 1, name: 'Tuesday · Nov 10' })
    expect(screen.queryByRole('button', { name: 'Pull from bank' })).toBeNull()
  })

  it('offers a way back to the week only when it has one', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    const { unmount } = render(<Day date="2026-11-12" today={WEDNESDAY_DAY} onBack={onBack} />)

    await user.click(await screen.findByRole('button', { name: 'Back to This week' }))
    expect(onBack).toHaveBeenCalled()

    unmount()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Back to This week' })).toBeNull()
  })

  it("offers no Pull from bank on a day of a week that hasn't opened", async () => {
    render(<Day date="2026-12-09" today={WEDNESDAY_DAY} onBack={() => {}} />)

    await screen.findByRole('heading', { level: 1, name: 'Wednesday · Dec 9' })
    expect(screen.queryByRole('button', { name: 'Pull from bank' })).toBeNull()
  })

  it('says a day in another week needs a connection when it can\'t load', async () => {
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    render(<Day date="2026-12-09" today={WEDNESDAY_DAY} onBack={() => {}} />)

    expect(await screen.findByText("Other weeks need a connection. They'll show once you're back online.")).toBeDefined()
  })

  it('calls the week just wrapped up early last week, on its days', async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 18, 0))
    await wrapUpWeek('2026-11-09')

    render(<Day date="2026-11-13" today="2026-11-15" onBack={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Back to Last week' })).toBeDefined()
  })

  it("names the day's week on the way back", async () => {
    const { unmount } = render(<Day date="2026-11-03" today={WEDNESDAY_DAY} onBack={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Back to Last week' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Back to Last week' }).textContent).toBe('‹ Last week')
    unmount()

    render(<Day date="2026-12-09" today={WEDNESDAY_DAY} onBack={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Back to Week of Dec 7' })).toBeDefined()
  })

  it('pins the back button, heading, count and progress bar together at the top', async () => {
    render(<Day date="2026-11-12" today={WEDNESDAY_DAY} onBack={() => {}} />)

    const heading = await screen.findByRole('heading', { level: 1, name: 'Thursday · Nov 12' })
    const pinned = heading.closest('.screen-top')
    expect(pinned).not.toBeNull()
    expect(pinned?.contains(screen.getByRole('button', { name: 'Back to This week' }))).toBe(true)
    expect(pinned?.contains(screen.getByRole('progressbar'))).toBe(true)
    expect(pinned?.textContent).toContain('0 of 11 done')
    expect(pinned?.contains(screen.getByRole('button', { name: 'List' }))).toBe(false)
  })

  it('shows a warm empty state when nothing is planned', async () => {
    const week = await getWeek('2026-11-09')
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => task.plannedDay !== '2026-11-11') })

    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect(await screen.findByText('Nothing planned today. The day is yours.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pull from bank' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/done$/)).toBeNull()
  })
})

describe("Day, a quitting goal's answer", () => {
  let goalId: string
  const row = () => screen.findByRole('group', { name: 'Quit sugar' })

  beforeEach(async () => {
    goalId = (await createGoal({ label: 'Quit sugar', measurableLine: '30 days', type: 'quitting', startDate: '2026-11-07' })).id
    for (const send of [answerQuitDay, clearQuitDay, rateUrge, clearUrgeRating]) vi.mocked(send).mockClear()
  })

  it('answers Held with one tap, under the tasks, without counting it as a task', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const quit = await row()

    expect(within(quit).queryByRole('group', { name: 'Urge' })).toBeNull()
    await user.click(within(quit).getByRole('button', { name: 'Held' }))

    expect(within(quit).getByRole('button', { name: 'Change: Held' })).toBeDefined()
    expect(answerQuitDay).toHaveBeenCalledWith(goalId, WEDNESDAY_DAY, true)
    expect(screen.getByText('0 of 4 done')).toBeDefined()
    const freeTime = screen.getByRole('region', { name: 'Free time' })
    expect(quit.compareDocumentPosition(freeTime) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers the urge once answered, and a second tap on the level clears it', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const quit = await row()
    await user.click(within(quit).getByRole('button', { name: 'Slipped' }))
    const urge = within(quit).getByRole('group', { name: 'Urge' })

    expect(within(urge).getAllByRole('button').map((button) => button.textContent)).toEqual(['Low', 'Some', 'Strong'])
    await user.click(within(urge).getByRole('button', { name: 'Some' }))
    expect(within(urge).getByRole('button', { name: 'Some' }).getAttribute('aria-pressed')).toBe('true')
    expect(rateUrge).toHaveBeenCalledWith(goalId, WEDNESDAY_DAY, 'some')

    await user.click(within(urge).getByRole('button', { name: 'Some' }))
    expect(within(urge).getByRole('button', { name: 'Some' }).getAttribute('aria-pressed')).toBe('false')
    expect(clearUrgeRating).toHaveBeenCalledWith(goalId, WEDNESDAY_DAY)
  })

  it('changes the answer, and clears it with its urge back to unknown', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const quit = await row()
    await user.click(within(quit).getByRole('button', { name: 'Held' }))
    await user.click(within(quit).getByRole('button', { name: 'Low' }))

    await user.click(within(quit).getByRole('button', { name: 'Change: Held' }))
    await user.click(within(quit).getByRole('button', { name: 'Slipped' }))
    expect(answerQuitDay).toHaveBeenLastCalledWith(goalId, WEDNESDAY_DAY, false)
    expect(within(quit).getByRole('button', { name: 'Change: Slipped' })).toBeDefined()

    await user.click(within(quit).getByRole('button', { name: 'Change: Slipped' }))
    await user.click(within(quit).getByRole('button', { name: 'Clear' }))

    expect(clearQuitDay).toHaveBeenCalledWith(goalId, WEDNESDAY_DAY)
    expect(clearUrgeRating).toHaveBeenCalledWith(goalId, WEDNESDAY_DAY)
    expect(within(quit).getByRole('button', { name: 'Held' })).toBeDefined()
    expect(within(quit).queryByRole('group', { name: 'Urge' })).toBeNull()
  })

  it('answers an opened past day for that day', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-09" today={WEDNESDAY_DAY} />)

    await user.click(within(await row()).getByRole('button', { name: 'Held' }))

    expect(answerQuitDay).toHaveBeenCalledWith(goalId, '2026-11-09', true)
  })

  it('offers nothing on a future day', async () => {
    render(<Day date="2026-11-13" today={WEDNESDAY_DAY} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Friday · Nov 13' })).toBeDefined()
    expect(screen.queryByRole('group', { name: 'Quit sugar' })).toBeNull()
  })

  it('shows on a day with nothing planned', async () => {
    const week = await getWeek('2026-11-09')
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => task.plannedDay !== WEDNESDAY_DAY) })
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect(await screen.findByText('Nothing planned today. The day is yours.')).toBeDefined()
    expect(await row()).toBeDefined()
  })

  it('shows the answer at once while it waits to send', async () => {
    vi.mocked(answerQuitDay).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const quit = await row()

    await user.click(within(quit).getByRole('button', { name: 'Held' }))

    expect(within(quit).getByRole('button', { name: 'Change: Held' })).toBeDefined()
    expect(await screen.findByText('1 change waiting to send')).toBeDefined()
  })
})

describe('Day in next week', () => {
  const TUESDAY_AFTER = '2026-11-17'

  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 10, 15, 18, 0))
  })

  it("can't be checked off, but its tasks can still be sent back", async () => {
    await placeTask('task-next-lift', '2026-11-16', TUESDAY_AFTER)
    render(<Day date={TUESDAY_AFTER} today="2026-11-15" />)

    const row = await screen.findByRole('checkbox', { name: 'Lift: squat day' })

    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Lift: squat day/ })).toBeDefined()
  })

  it("pulls from next week's bank, not this week's", async () => {
    render(<Day date={TUESDAY_AFTER} today="2026-11-15" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Pull from bank' }))

    const sheet = await screen.findByRole('dialog')

    expect(await within(sheet).findByText('Lift: squat day')).toBeDefined()
    expect(within(sheet).queryByText('Call the dentist')).toBeNull()
  })
})

describe('Day, Still matter?', () => {
  const asking = () => screen.findByRole('group', { name: 'Still matter? Call the dentist' })

  it('asks at the top of Today, and not on another day', async () => {
    const { unmount } = render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    expect(await asking()).toBeDefined()
    unmount()

    render(<Day date="2026-11-12" today={WEDNESDAY_DAY} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Still matter?')).toBeNull()
  })

  it('keeps it: sends the answer, and the card goes', async () => {
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    const card = await asking()

    await userEvent.click(within(card).getByRole('button', { name: 'Keep' }))

    expect(answerStillMatters).toHaveBeenCalledWith('task-dentist', { answer: 'keep' })
    expect(screen.queryByText('Still matter?')).toBeNull()
  })

  it('drops it', async () => {
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await userEvent.click(within(await asking()).getByRole('button', { name: 'Drop' }))

    expect(answerStillMatters).toHaveBeenCalledWith('task-dentist', { answer: 'drop' })
    expect(screen.queryByText('Still matter?')).toBeNull()
  })

  it('reschedules it onto a day it picks, and it shows on that day when that is today', async () => {
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await userEvent.click(within(await asking()).getByRole('button', { name: 'Reschedule' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Today' }))

    expect(answerStillMatters).toHaveBeenCalledWith('task-dentist', {
      answer: 'schedule',
      week: '2026-11-09',
      day: WEDNESDAY_DAY,
    })
    expect(screen.queryByText('Still matter?')).toBeNull()
    expect(await screen.findByText('Call the dentist')).toBeDefined()
  })

  it('puts the card back, and says so, when the answer fails', async () => {
    vi.mocked(answerStillMatters).mockRejectedValueOnce(new Error('offline'))
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await userEvent.click(within(await asking()).getByRole('button', { name: 'Keep' }))

    expect(await asking()).toBeDefined()
    expect((await screen.findByRole('status')).textContent).toBe("Couldn't save that. Try again.")
  })

  it('hides it for the day on Not now, and changes nothing', async () => {
    const first = render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await userEvent.click(within(await asking()).getByRole('button', { name: 'Not now' }))

    expect(screen.queryByText('Still matter?')).toBeNull()
    expect(answerStillMatters).not.toHaveBeenCalled()
    first.unmount()

    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Still matter?')).toBeNull()
  })

  it('asks again the next day', async () => {
    const first = render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await userEvent.click(within(await asking()).getByRole('button', { name: 'Not now' }))
    first.unmount()

    vi.setSystemTime(new Date(2026, 10, 12, 9, 0))
    render(<Day date="2026-11-12" today="2026-11-12" />)

    expect(await asking()).toBeDefined()
  })

  describe('deleting a task made by mistake', () => {
    async function askToDelete(user: ReturnType<typeof userEvent.setup>, title: string) {
      await user.click(await screen.findByRole('button', { name: `More for ${title}` }))
      const actions = screen.getAllByRole('button').filter((button) => button.closest('.task-menu-actions'))
      expect(actions.at(-1)?.textContent).toBe('Delete (made by mistake)')
      await user.click(screen.getByRole('button', { name: 'Delete (made by mistake)' }))
    }

    it('asks once, naming the task, then takes it off the day and the count', async () => {
      const user = userEvent.setup()
      render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

      await askToDelete(user, 'Fill out my ballot')
      expect(screen.getByRole('heading', { name: 'Delete “Fill out my ballot”? It goes as if it was never made.' })).toBeDefined()
      expect(deleteTask).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Fill out my ballot' })).toBeNull())
      expect(deleteTask).toHaveBeenCalledExactlyOnceWith('task-ballot')
      expect(screen.getByText('0 of 3 done')).toBeDefined()
    })

    it('sends nothing on Cancel', async () => {
      const user = userEvent.setup()
      render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

      await askToDelete(user, 'Fill out my ballot')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(deleteTask).not.toHaveBeenCalled()
      expect(screen.getByRole('checkbox', { name: 'Fill out my ballot' })).toBeDefined()
    })

    it('keeps the task, with a message, when it can\'t be deleted', async () => {
      vi.mocked(deleteTask).mockRejectedValueOnce(new Error('offline'))
      const user = userEvent.setup()
      render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

      await askToDelete(user, 'Fill out my ballot')
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(await screen.findByText("Couldn't delete that. Try again.")).toBeDefined()
      expect(screen.getByRole('checkbox', { name: 'Fill out my ballot' })).toBeDefined()
      expect(screen.getByText('0 of 4 done')).toBeDefined()
    })

    it('deletes a fixed-day task the app placed', async () => {
      const user = userEvent.setup()
      render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

      await askToDelete(user, 'Take out the trash')
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Take out the trash' })).toBeNull())
    })
  })
})
