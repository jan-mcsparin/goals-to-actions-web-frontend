import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOffTask, getBank, getDay, pullFromBank } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { Bank } from '../api/types.ts'
import { Day } from './Day.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    checkOffTask: vi.fn(actual.checkOffTask),
    getDay: vi.fn(actual.getDay),
    getBank: vi.fn(actual.getBank),
    pullFromBank: vi.fn(actual.pullFromBank),
    skipTask: vi.fn(actual.skipTask),
    swapTask: vi.fn(actual.swapTask),
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const ONE_TASK_BANK: Bank = {
  weekOf: '2026-11-09',
  tasks: [{ id: 'task-dentist', title: 'Call the dentist', status: 'inBank', weekOf: '2026-11-09', rolloverCount: 2 }],
  goals: [],
  aspirations: [],
  recurringItems: [],
}

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
    expect(rowTitles(keep)).toEqual(['Move the car for street sweeping', 'Laundry', 'Fill out my ballot'])
    expect(within(keep).getByText('by 7 a.m.')).toBeDefined()

    const forward = screen.getByRole('region', { name: 'Move forward' })
    expect(rowTitles(forward)).toEqual(['Lift: bench day'])
    expect(within(forward).getByText('at 6 p.m.')).toBeDefined()
    expect(within(forward).getByText('Be strong · Be fit')).toBeDefined()

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
    vi.mocked(checkOffTask).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('checkbox', { name: 'Laundry' }))

    const message = await screen.findByRole('status')
    expect(message.className).toBe('screen-message')
    expect(message.textContent).toBe("Couldn't save that. Try again.")

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getDay).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    const message = await screen.findByRole('button', { name: "Couldn't load today. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("still shows the day's heading when it can't load", async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new Error('offline'))
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await screen.findByRole('status')
    const heading = screen.getByRole('heading', { level: 1, name: 'Today · Wednesday' })
    expect(heading.closest('.screen-top')).not.toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('still shows an opened day with its way back when it can\'t load', async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new Error('offline'))
    render(<Day date="2026-11-12" today={WEDNESDAY_DAY} onBack={() => {}} />)

    await screen.findByRole('status')
    expect(screen.getByRole('heading', { level: 1, name: 'Thursday · Nov 12' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Back to Week' })).toBeDefined()
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

    unmount()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect((await screen.findByRole('button', { name: 'By goal' })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false')
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
      'Lift: deadlift day',
    ])
    expect(screen.getByText('0 of 5 done')).toBeDefined()
    expect(pullFromBank).toHaveBeenCalledWith('task-lift-bank', WEDNESDAY_DAY)
  })

  it('says so when the bank is empty, and closes', async () => {
    vi.mocked(getBank).mockResolvedValueOnce({
      weekOf: '2026-11-09',
      tasks: [],
      goals: [],
      aspirations: [],
      recurringItems: [],
    })
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(await within(sheet).findByText('Nothing in the bank.')).toBeDefined()

    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
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

  it('swaps a task for one from the bank, keeping its place in the day', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'More for Laundry' }))
    await user.click(screen.getByRole('button', { name: 'Swap' }))
    const sheet = await screen.findByRole('dialog', { name: 'Swap Laundry for' })
    await user.click(await within(sheet).findByRole('button', { name: 'Call the dentist' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rowTitles(screen.getByRole('region', { name: 'Keep life running' }))).toEqual([
      'Move the car for street sweeping',
      'Call the dentist',
      'Fill out my ballot',
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

  it('shows the bank sheet loading until the bank arrives', async () => {
    const load = deferred<Bank>()
    vi.mocked(getBank).mockReturnValueOnce(load.promise)
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(within(sheet).getByText('Loading…')).toBeDefined()

    await act(async () => load.resolve(ONE_TASK_BANK))

    expect(within(sheet).queryByText('Loading…')).toBeNull()
    expect(within(sheet).getByRole('button', { name: 'Call the dentist' })).toBeDefined()
  })

  it("says so inside the sheet when the bank can't load", async () => {
    vi.mocked(getBank).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })

    expect(await within(sheet).findByText("Couldn't open the bank. Try again in a moment.")).toBeDefined()
  })

  it('reloads the bank each time the sheet opens, without showing the old list', async () => {
    const user = userEvent.setup()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }))

    vi.mocked(getBank).mockReturnValueOnce(new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })

    expect(within(sheet).getByText('Loading…')).toBeDefined()
    expect(within(sheet).queryByRole('button', { name: 'Lift: deadlift day' })).toBeNull()
  })

  it('shows another day with its own heading, and pulls bank tasks onto it', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-13" today={WEDNESDAY_DAY} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Friday · Nov 13' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    await user.click(await within(sheet).findByRole('button', { name: 'Lift: deadlift day' }))

    expect(screen.getByRole('checkbox', { name: 'Lift: deadlift day' })).toBeDefined()
    expect(pullFromBank).toHaveBeenCalledWith('task-lift-bank', '2026-11-13')
  })

  it('lets you check off a task on another day', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

    const trash = await screen.findByRole('checkbox', { name: 'Take out the trash' })
    await user.click(trash)

    expect(trash.getAttribute('aria-checked')).toBe('true')
  })

  it('keeps fixed-day items in place: no menu, but they can still be checked off', async () => {
    const user = userEvent.setup()
    render(<Day date="2026-11-10" today={WEDNESDAY_DAY} />)

    const trash = await screen.findByRole('checkbox', { name: 'Take out the trash' })
    expect(screen.queryByRole('button', { name: 'More for Take out the trash' })).toBeNull()
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

    await user.click(await screen.findByRole('button', { name: 'Back to Week' }))
    expect(onBack).toHaveBeenCalled()

    unmount()
    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Back to Week' })).toBeNull()
  })

  it('pins the back button, heading, count and progress bar together at the top', async () => {
    render(<Day date="2026-11-12" today={WEDNESDAY_DAY} onBack={() => {}} />)

    const heading = await screen.findByRole('heading', { level: 1, name: 'Thursday · Nov 12' })
    const pinned = heading.closest('.screen-top')
    expect(pinned).not.toBeNull()
    expect(pinned?.contains(screen.getByRole('button', { name: 'Back to Week' }))).toBe(true)
    expect(pinned?.contains(screen.getByRole('progressbar'))).toBe(true)
    expect(pinned?.textContent).toContain('0 of 11 done')
    expect(pinned?.contains(screen.getByRole('button', { name: 'List' }))).toBe(false)
  })

  it('shows a warm empty state when nothing is planned', async () => {
    vi.mocked(getDay).mockResolvedValueOnce({
      date: '2026-11-11',
      tasks: [],
      goals: [],
      aspirations: [],
      recurringItems: [],
    })

    render(<Day date={WEDNESDAY_DAY} today={WEDNESDAY_DAY} />)

    expect(await screen.findByText('Nothing planned today. The day is yours.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pull from bank' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/done$/)).toBeNull()
  })
})
