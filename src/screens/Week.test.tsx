import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore } from '../api/mockStore.ts'
import { Week } from './Week.tsx'

const WEDNESDAY_DAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

function dayButtons() {
  return within(screen.getByRole('region', { name: 'Days' })).getAllByRole('button')
}

describe('Week', () => {
  it('shows the week and its range', async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeDefined()
    expect(screen.getByText('Nov 9–15')).toBeDefined()
  })

  it("shows each goal's progress and pacing", async () => {
    render(<Week today={WEDNESDAY_DAY} onOpenDay={() => {}} />)

    const progress = await screen.findByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('Be strong · Be fit')).toBeDefined()
    expect(within(progress).getByText('1 of 3')).toBeDefined()
    expect(within(progress).getByText('5 days left · 1 more to plan')).toBeDefined()
    expect(within(progress).getByRole('progressbar', { name: 'Be strong · Be fit' })).toBeDefined()
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
})
