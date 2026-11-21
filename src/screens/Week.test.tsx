import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWeek, placeTask, wrapUpWeek } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Week } from './Week.tsx'
import { isInBank } from '../domain/tasks.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getWeek: vi.fn(actual.getWeek), placeTask: vi.fn(actual.placeTask), wrapUpWeek: vi.fn(actual.wrapUpWeek) }
})

const WEDNESDAY_DAY = '2026-11-11'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

// For the tests that wait out a message: timeouts are faked too, and still
// run on their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
}

function dayButtons() {
  return within(screen.getByRole('region', { name: 'Days' })).getAllByRole('button')
}

describe('Week', () => {
  it('shows the week and its range', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.getByText('Nov 9–15')).toBeDefined()
  })

  it('pins the heading and range at the top', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const pinned = (await screen.findByRole('heading', { level: 1, name: 'This week' })).closest('.screen-top')
    expect(pinned?.textContent).toContain('Nov 9–15')
  })

  it("shows each goal's progress and pacing", async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const progress = await screen.findByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('Be strong · Be fit')).toBeDefined()
    expect(within(progress).getByText('1 of 3')).toBeDefined()
    expect(within(progress).getByRole('progressbar', { name: 'Be strong · Be fit' })).toBeDefined()
    expect(within(progress).getByText('Have endurance · Be fit')).toBeDefined()
    expect(within(progress).getByText('1 of 2')).toBeDefined()
    expect(within(progress).getAllByText('5 days left · 1 more to plan')).toHaveLength(2)
  })

  it('lists Monday to Sunday, marking today and dimming past days', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)
    await screen.findByRole('region', { name: 'Days' })

    const days = dayButtons()
    expect(days.map((day) => day.querySelector('.week-day-name')?.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ])
    expect(days.map((day) => day.getAttribute('aria-current'))).toEqual([null, null, 'date', null, null, null, null])
    expect(days.map((day) => day.dataset.past)).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
    expect(days[0].textContent).toContain('done')
    expect(days[1].textContent).toContain('Take out the trash by 7 a.m.')
    expect(days[6].textContent).toContain('Free day')
  })

  it('opens a day when you tap it', async () => {
    const onOpenDay = vi.fn()
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={onOpenDay} />)
    await screen.findByRole('region', { name: 'Days' })

    await user.click(dayButtons()[3])

    expect(onOpenDay).toHaveBeenCalledWith('2026-11-12')
  })

  it('lists the bank as chips', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const bank = await screen.findByRole('region', { name: 'Bank · 4 not on a day' })
    expect(within(bank).getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'Lift: deadlift day',
      'Sort the garage shelves',
      'Call the dentist',
      'Run: intervals',
    ])
    expect(within(bank).getByText('Tap to put on a day.')).toBeDefined()
  })

  it('puts a bank task on the day you pick, from today onward', async () => {
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    const sheet = await screen.findByRole('dialog', { name: 'Put on a day' })
    expect(within(sheet).getAllByRole('button', { name: /day$/ }).map((day) => day.textContent)).toEqual([
      'Today',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ])

    await user.click(within(sheet).getByRole('button', { name: 'Thursday' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(dayButtons()[3].textContent).toContain('Call the dentist')
    expect(screen.getByRole('region', { name: 'Bank · 3 not on a day' })).toBeDefined()
    expect(placeTask).toHaveBeenCalledWith('task-dentist', '2026-11-09', '2026-11-12')
  })

  it('updates pacing when a goal task is placed', async () => {
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Lift: deadlift day' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Saturday' }))

    expect(screen.getByText('5 days left · on pace')).toBeDefined()
  })

  it("keeps the chip on its day, with no message, when the save can't be sent", async () => {
    vi.mocked(placeTask).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Friday' }))
    await act(async () => {})

    expect(placeTask).toHaveBeenCalled()
    expect(dayButtons()[4].textContent).toContain('Call the dentist')
    expect(screen.queryByRole('status')).toBeNull()
    vi.mocked(placeTask).mockReset()
  })

  it('lets a failed save go after a few seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    sundayEvening()
    vi.mocked(wrapUpWeek).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Next week' }))
    await user.click(await screen.findByRole('button', { name: 'Wrap up this week' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Wrap up this week' }))
    expect(await screen.findByRole('status')).toBeDefined()

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const message = await screen.findByRole('button', { name: "Couldn't load this week. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("still shows the heading and range when it can't load", async () => {
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await screen.findByRole('status')
    const heading = screen.getByRole('heading', { level: 1, name: 'This week' })
    expect(heading.closest('.screen-top')).not.toBeNull()
    expect(screen.getByText('Nov 9–15')).toBeDefined()
  })

  it('says so when the bank is empty', async () => {
    const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts')
    const week = await actual.getWeek()
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => !isInBank(task)) })
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const bank = await screen.findByRole('region', { name: 'Bank' })
    expect(within(bank).getByText('Nothing in the bank.')).toBeDefined()
  })
})

const SUNDAY_DAY = '2026-11-15'

function sundayEvening() {
  vi.setSystemTime(new Date(2026, 10, 15, 18, 0))
}

describe('Week, next week', () => {
  it('offers no toggle until next week is open', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)
    await screen.findByRole('region', { name: 'Days' })

    expect(screen.queryByRole('group', { name: 'Week' })).toBeNull()
  })

  it('offers This week and Next week from Sunday at 6 p.m.', async () => {
    sundayEvening()
    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)

    const toggle = await screen.findByRole('group', { name: 'Week' })
    expect(within(toggle).getByRole('button', { name: 'This week' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(toggle).getByRole('button', { name: 'Next week' }).getAttribute('aria-pressed')).toBe('false')
  })

  it("shows next week's range, days and bank, and opens its days", async () => {
    sundayEvening()
    const onOpenDay = vi.fn()
    render(<Week today={SUNDAY_DAY} onOpenDay={onOpenDay} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Next week' })).toBeDefined()
    expect(screen.getByText('Nov 16–22')).toBeDefined()
    expect(dayButtons().map((day) => day.querySelector('.week-day-name')?.textContent)).toEqual([
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
    ])
    const bank = screen.getByRole('region', { name: /^Bank/ })
    expect(within(bank).getAllByRole('button').length).toBeGreaterThan(0)
    await userEvent.click(dayButtons()[1])
    expect(onOpenDay).toHaveBeenCalledWith('2026-11-17')
  })

  it("puts a task from next week's bank on one of its days", async () => {
    sundayEvening()
    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    const bank = await screen.findByRole('region', { name: /^Bank/ })

    await userEvent.click(within(bank).getAllByRole('button')[0])
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Tue/ }))

    expect(placeTask).toHaveBeenCalledWith(expect.any(String), '2026-11-16', '2026-11-17')
    expect(dayButtons()[1].textContent).not.toContain('Free day')
  })

  it('opens on the view chosen last time', async () => {
    sundayEvening()
    const first = render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    first.unmount()

    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Next week' })).toBeDefined()
  })

  it('falls back to This week when next week is not open', async () => {
    localStorage.setItem('gta.weekView', 'next')
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
  })
})

describe('Week, wrapping up', () => {
  async function openSheet() {
    sundayEvening()
    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Wrap up this week' }))
    return await screen.findByRole('dialog')
  }

  it("is offered on next week only, and opens a sheet of what carries over and what ends", async () => {
    sundayEvening()
    render(<Week today={SUNDAY_DAY} onOpenDay={() => {}} />)
    await screen.findByRole('region', { name: 'Days' })
    expect(screen.queryByRole('button', { name: 'Wrap up this week' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Wrap up this week' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(within(sheet).getByRole('region', { name: 'Carries over to next week' })).getByText('Call the dentist')).toBeDefined()
    expect(within(within(sheet).getByRole('region', { name: 'Ends with this week' })).getByText('Lift: deadlift day')).toBeDefined()
  })

  it('makes next week the current one when confirmed, and the toggle goes', async () => {
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Wrap up this week' }))

    expect(wrapUpWeek).toHaveBeenCalledWith('2026-11-09')
    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.getByText('Nov 16–22')).toBeDefined()
    expect(screen.queryByRole('group', { name: 'Week' })).toBeNull()
    expect(localStorage.getItem('gta.weekView')).toBe('this')
  })

  it('leaves the week as it was, and says so, when wrapping up fails', async () => {
    vi.mocked(wrapUpWeek).mockRejectedValueOnce(new Error('offline'))
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Wrap up this week' }))

    expect(await screen.findByText("Couldn't wrap up the week. Nothing changed.")).toBeDefined()
    expect(screen.getByRole('heading', { level: 1, name: 'Next week' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Next week' }).getAttribute('aria-pressed')).toBe('true')
  })
})
