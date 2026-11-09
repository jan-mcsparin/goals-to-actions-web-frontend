import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToday } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Today } from './Today.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getToday: vi.fn(actual.getToday) }
})

// Wednesday 11 Nov 2026, 9 a.m. local time. Only Date is faked, so RTL's
// polling timers still run.
const WEDNESDAY = new Date(2026, 10, 11, 9, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY)
  resetStore()
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
