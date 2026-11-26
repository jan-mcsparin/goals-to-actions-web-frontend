import { act, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteTask, getWeek, placeTask, wrapUpWeek } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Week } from './Week.tsx'
import { isInBank } from '../domain/tasks.ts'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    deleteTask: vi.fn(actual.deleteTask),
    getWeek: vi.fn(actual.getWeek),
    placeTask: vi.fn(actual.placeTask),
    wrapUpWeek: vi.fn(actual.wrapUpWeek),
  }
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
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.getByText('Nov 9–15')).toBeDefined()
  })

  it('pins the heading and range at the top', async () => {
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    const pinned = (await screen.findByRole('heading', { level: 1, name: 'This week' })).closest('.screen-top')
    expect(pinned?.textContent).toContain('Nov 9–15')
  })

  it("shows each goal's progress and pacing", async () => {
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    const progress = await screen.findByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('Be strong · Be fit')).toBeDefined()
    expect(within(progress).getByText('1 of 3')).toBeDefined()
    expect(within(progress).getByRole('progressbar', { name: 'Be strong · Be fit' })).toBeDefined()
    expect(within(progress).getByText('Have endurance · Be fit')).toBeDefined()
    expect(within(progress).getByText('1 of 2')).toBeDefined()
    expect(within(progress).getAllByText('5 days left · 1 more to plan')).toHaveLength(2)
  })

  it('lists Monday to Sunday, marking today and dimming past days', async () => {
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)
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

  it('marks a full day quietly, and a done day as done', async () => {
    const mockWeek = vi.mocked(getWeek).getMockImplementation()!
    vi.mocked(getWeek).mockImplementationOnce(async (week) => {
      const plan = await mockWeek(week)
      return { ...plan, days: plan.days.map((day) => ({ ...day, full: day.day <= '2026-11-12' })) }
    })
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)
    await screen.findByRole('region', { name: 'Days' })

    const marks = dayButtons().map((day) => day.querySelector('.week-day-mark')?.textContent ?? null)
    expect(marks).toEqual(['done', 'Full', 'Full', 'Full', null, null, null])
  })

  it('opens a day when you tap it', async () => {
    const onOpenDay = vi.fn()
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={onOpenDay} />)
    await screen.findByRole('region', { name: 'Days' })

    await user.click(dayButtons()[3])

    expect(onOpenDay).toHaveBeenCalledWith('2026-11-12')
  })

  it('lists the bank as chips', async () => {
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

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
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

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

  it('deletes a bank task made by mistake, from the sheet it opens', async () => {
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    const sheet = await screen.findByRole('dialog', { name: 'Put on a day' })
    await user.click(within(sheet).getByRole('button', { name: 'Delete (made by mistake)' }))
    const asking = await screen.findByRole('dialog', { name: 'Delete “Call the dentist”? It goes as if it was never made.' })
    await user.click(within(asking).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('region', { name: 'Bank · 3 not on a day' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Call the dentist' })).toBeNull()
    expect(deleteTask).toHaveBeenCalledExactlyOnceWith('task-dentist')
  })

  it("keeps a bank task, with a message, when it can't be deleted", async () => {
    vi.mocked(deleteTask).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Call the dentist' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Put on a day' })).getByRole('button', { name: 'Delete (made by mistake)' }))
    await user.click(within(await screen.findByRole('dialog', { name: /^Delete “Call the dentist”/ })).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText("Couldn't delete that. Try again.")).toBeDefined()
    expect(screen.getByRole('region', { name: 'Bank · 4 not on a day' })).toBeDefined()
  })

  it('updates pacing when a goal task is placed', async () => {
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Lift: deadlift day' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Saturday' }))

    expect(screen.getByText('5 days left · on pace')).toBeDefined()
  })

  it("keeps the chip on its day, with no message, when the save can't be sent", async () => {
    vi.mocked(placeTask).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

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
    render(<Stepping today={SUNDAY_DAY} />)

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
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    const message = await screen.findByRole('button', { name: "Couldn't load this week. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("still shows the heading and range when it can't load", async () => {
    vi.mocked(getWeek).mockRejectedValueOnce(new Error('offline'))
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    await screen.findByRole('status')
    const heading = screen.getByRole('heading', { level: 1, name: 'This week' })
    expect(heading.closest('.screen-top')).not.toBeNull()
    expect(screen.getByText('Nov 9–15')).toBeDefined()
  })

  it('says so when the bank is empty', async () => {
    const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts')
    const week = await actual.getWeek()
    vi.mocked(getWeek).mockResolvedValueOnce({ ...week, tasks: week.tasks.filter((task) => !isInBank(task)) })
    render(<Week today={WEDNESDAY_DAY} onShowWeek={() => {}} onOpenDay={() => {}} />)

    const bank = await screen.findByRole('region', { name: 'Bank' })
    expect(within(bank).getByText('Nothing in the bank.')).toBeDefined()
  })
})

const SUNDAY_DAY = '2026-11-15'

function sundayEvening() {
  vi.setSystemTime(new Date(2026, 10, 15, 18, 0))
}

// Week as App shows it: the week on show lives in the open screen.
function Stepping({ today, from, onOpenDay = () => {} }: { today: string; from?: string; onOpenDay?: (date: string) => void }) {
  const [week, setWeek] = useState(from)
  return <Week today={today} week={week} onShowWeek={setWeek} onOpenDay={onOpenDay} />
}

function title() {
  return screen.getByRole('heading', { level: 1 }).textContent
}

describe('Week, any week', () => {
  it('steps back to last week and forward to later ones, with their ranges', async () => {
    const user = userEvent.setup()
    render(<Stepping today={WEDNESDAY_DAY} />)
    await screen.findByRole('region', { name: 'Days' })

    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Last week' })).toBeDefined()
    expect(screen.getByText('Nov 2–8')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(title()).toBe('Next week')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(title()).toBe('Week of Nov 23')
    expect(screen.getByText('Nov 23–29')).toBeDefined()
  })

  it('stops at the first week with rows, and 12 weeks ahead', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Stepping today={WEDNESDAY_DAY} from="2026-11-02" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Last week' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Previous week' }).hasAttribute('disabled')).toBe(true)
    unmount()

    render(<Stepping today={WEDNESDAY_DAY} from="2027-01-25" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Week of Jan 25' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(title()).toBe('Week of Feb 1')
    expect(screen.getByRole('button', { name: 'Next week' }).hasAttribute('disabled')).toBe(true)
  })

  it('opens this week when the remembered one is out of reach', async () => {
    render(<Stepping today={WEDNESDAY_DAY} from="2026-01-05" />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
  })

  it('goes back to this week from any other', async () => {
    const user = userEvent.setup()
    render(<Stepping today={WEDNESDAY_DAY} from="2026-12-07" />)
    await screen.findByRole('heading', { level: 1, name: 'Week of Dec 7' })

    await user.click(screen.getByRole('button', { name: 'This week' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'This week' })).toBeNull()
  })

  it("opens another week's days", async () => {
    const onOpenDay = vi.fn()
    render(<Stepping today={WEDNESDAY_DAY} from="2026-12-07" onOpenDay={onOpenDay} />)
    await screen.findByRole('heading', { level: 1, name: 'Week of Dec 7' })

    await userEvent.click((await screen.findAllByRole('button', { name: /^Tue/ }))[0])

    expect(onOpenDay).toHaveBeenCalledWith('2026-12-08')
  })

  it('says other weeks need a connection when one fails to load, under its header', async () => {
    const actual = await vi.importActual<typeof import('../api/client.ts')>('../api/client.ts')
    vi.mocked(getWeek).mockImplementation(async (week) => {
      if (week === '2026-12-07') throw new Error('offline')
      return actual.getWeek(week)
    })
    render(<Stepping today={WEDNESDAY_DAY} from="2026-12-07" />)

    expect(await screen.findByText("Other weeks need a connection. They'll show once you're back online.")).toBeDefined()
    expect(title()).toBe('Week of Dec 7')
    expect(screen.getByText('Dec 7–13')).toBeDefined()
  })
})

describe('Week, next week', () => {
  it("shows next week's days and bank once it's open, and opens its days", async () => {
    sundayEvening()
    const onOpenDay = vi.fn()
    render(<Stepping today={SUNDAY_DAY} onOpenDay={onOpenDay} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Next week' })).toBeDefined()
    expect(screen.getByText('Nov 16–22')).toBeDefined()
    const bank = await screen.findByRole('region', { name: /^Bank/ })
    expect(within(bank).getAllByRole('button').length).toBeGreaterThan(0)
    await userEvent.click(dayButtons()[1])
    expect(onOpenDay).toHaveBeenCalledWith('2026-11-17')
  })

  it("puts a task from next week's bank on one of its days", async () => {
    sundayEvening()
    render(<Stepping today={SUNDAY_DAY} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    const bank = await screen.findByRole('region', { name: /^Bank/ })

    await userEvent.click(within(bank).getAllByRole('button')[0])
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Tue/ }))

    expect(placeTask).toHaveBeenCalledWith(expect.any(String), '2026-11-16', '2026-11-17')
    expect(dayButtons()[1].textContent).not.toContain('Free day')
  })
})

describe('Week, wrapping up', () => {
  async function openSheet() {
    sundayEvening()
    render(<Stepping today={SUNDAY_DAY} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Wrap up this week' }))
    return await screen.findByRole('dialog')
  }

  it("is offered on next week only, and opens a sheet of what carries over and what ends", async () => {
    sundayEvening()
    render(<Stepping today={SUNDAY_DAY} />)
    await screen.findByRole('region', { name: 'Days' })
    expect(screen.queryByRole('button', { name: 'Wrap up this week' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Wrap up this week' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(within(sheet).getByRole('region', { name: 'Carries over to next week' })).getByText('Call the dentist')).toBeDefined()
    expect(within(within(sheet).getByRole('region', { name: 'Ends with this week' })).getByText('Lift: deadlift day')).toBeDefined()
  })

  it('makes next week the current one when confirmed', async () => {
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Wrap up this week' }))

    expect(wrapUpWeek).toHaveBeenCalledWith('2026-11-09')
    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.getByText('Nov 16–22')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Wrap up this week' })).toBeNull()
  })

  it('leaves the week as it was, and says so, when wrapping up fails', async () => {
    vi.mocked(wrapUpWeek).mockRejectedValueOnce(new Error('offline'))
    const sheet = await openSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Wrap up this week' }))

    expect(await screen.findByText("Couldn't wrap up the week. Nothing changed.")).toBeDefined()
    expect(screen.getByRole('heading', { level: 1, name: 'Next week' })).toBeDefined()
  })
})
