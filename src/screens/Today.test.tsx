import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBank, getToday, pullFromBank } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Today } from './Today.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    getToday: vi.fn(actual.getToday),
    getBank: vi.fn(actual.getBank),
    pullFromBank: vi.fn(actual.pullFromBank),
    skipTask: vi.fn(actual.skipTask),
    swapTask: vi.fn(actual.swapTask),
  }
})

// Wednesday 11 Nov 2026, 9 a.m. local time. Only Date is faked, so RTL's
// polling timers still run.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY)
  resetStore()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function rowTitles(group: HTMLElement) {
  return within(group)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.task-title')?.textContent)
}

describe('Today', () => {
  it("shows today's plan in groups, in day order, with progress", async () => {
    render(<Today />)

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
    render(<Today />)
    const laundry = await screen.findByRole('checkbox', { name: 'Laundry' })

    await user.click(laundry)

    expect(laundry.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('1 of 4 done')).toBeDefined()

    await user.click(laundry)

    expect(laundry.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('0 of 4 done')).toBeDefined()
  })

  it('switches to goal cards and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Today />)

    await user.click(await screen.findByRole('button', { name: 'By goal' }))

    expect(screen.getByRole('button', { name: 'By goal' }).getAttribute('aria-pressed')).toBe('true')
    const card = screen.getByRole('region', { name: 'Be strong · Be fit' })
    expect(rowTitles(card)).toEqual(['Lift: bench day'])
    expect(within(card).queryByText('Be strong · Be fit', { selector: '.task-subline' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Keep life running' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Move forward' })).toBeNull()

    unmount()
    render(<Today />)

    expect((await screen.findByRole('button', { name: 'By goal' })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('pulls a task from the bank onto today', async () => {
    const user = userEvent.setup()
    render(<Today />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3)

    await user.click(within(sheet).getByRole('button', { name: 'Lift: deadlift day' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rowTitles(screen.getByRole('region', { name: 'Move forward' }))).toEqual([
      'Lift: bench day',
      'Lift: deadlift day',
    ])
    expect(screen.getByText('0 of 5 done')).toBeDefined()
    expect(pullFromBank).toHaveBeenCalledWith('task-lift-bank')
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
    render(<Today />)

    await user.click(await screen.findByRole('button', { name: 'Pull from bank' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pull from bank' })
    expect(await within(sheet).findByText('Nothing in the bank.')).toBeDefined()

    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sends a task back to the bank from its menu', async () => {
    const user = userEvent.setup()
    render(<Today />)

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
    render(<Today />)

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
  })

  it('offers no menu on a done task, since a tap undoes it', async () => {
    const user = userEvent.setup()
    render(<Today />)

    await user.click(await screen.findByRole('checkbox', { name: 'Laundry' }))

    expect(screen.queryByRole('button', { name: 'More for Laundry' })).toBeNull()
  })

  it('shows a warm empty state when nothing is planned', async () => {
    vi.mocked(getToday).mockResolvedValueOnce({
      date: '2026-11-11',
      tasks: [],
      goals: [],
      aspirations: [],
      recurringItems: [],
    })

    render(<Today />)

    expect(await screen.findByText('Nothing planned today. The day is yours.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pull from bank' })).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/done$/)).toBeNull()
  })
})
