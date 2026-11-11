import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWeek, pullFromBank } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Week } from './Week.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getWeek: vi.fn(actual.getWeek), pullFromBank: vi.fn(actual.pullFromBank) }
})

const WEDNESDAY_DAY = '2026-11-11'

beforeEach(() => {
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
    expect(pullFromBank).toHaveBeenCalledWith('task-dentist', '2026-11-12')
  })

  it('updates pacing when a goal task is placed', async () => {
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Lift: deadlift day' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Saturday' }))

    expect(screen.getByText('5 days left · on pace')).toBeDefined()
  })

  it('puts the chip back and says so calmly when the save fails', async () => {
    vi.mocked(pullFromBank).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Friday' }))
    await act(async () => {})

    expect(screen.getByRole('region', { name: 'Bank · 4 not on a day' })).toBeDefined()
    expect(dayButtons()[4].textContent).not.toContain('Call the dentist')
    expect(screen.getByRole('status').className).toBe('screen-message')
    expect(screen.getByRole('status').textContent).toBe("Couldn't save that. Try again.")
  })

  it('lets a failed save go after a few seconds', async () => {
    fakeTimeouts()
    vi.mocked(pullFromBank).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Friday' }))
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
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => task.status !== 'inBank') })
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const bank = await screen.findByRole('region', { name: 'Bank' })
    expect(within(bank).getByText('Nothing in the bank.')).toBeDefined()
  })
})
