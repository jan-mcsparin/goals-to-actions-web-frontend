import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getUpkeep } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Upkeep } from './Upkeep.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getUpkeep: vi.fn(actual.getUpkeep) }
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

function rows(section: HTMLElement) {
  return within(section)
    .getAllByRole('listitem')
    .map((row) => [row.querySelector('.upkeep-title')?.textContent, row.querySelector('.upkeep-detail')?.textContent])
}

describe('Keep life running', () => {
  it('pins the way back, the heading and its one line at the top', async () => {
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    const heading = await screen.findByRole('heading', { level: 1, name: 'Keep life running' })
    const top = heading.closest('.screen-top') as HTMLElement
    expect(within(top).getByRole('button', { name: 'Back to Aspirations' }).textContent).toBe('‹ Aspirations')
    expect(within(top).getByText('The things that have to happen, under no goal.')).toBeDefined()
  })

  it('lists the recurring items with no aspiration and their repeat rule', async () => {
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    expect(rows(await screen.findByRole('region', { name: 'Recurring' }))).toEqual([['Pay rent', 'Monthly on the 1st']])
  })

  it('lists the loose tasks still to do, with where each sits and its due date', async () => {
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    const todo = rows(await screen.findByRole('region', { name: 'To do' }))
    expect(todo).toHaveLength(13)
    expect(todo.slice(0, 3)).toEqual([
      ['Move the car for street sweeping', 'Today'],
      ['Fill out my ballot', 'Today · due Nov 13'],
      ['Groceries', 'Thursday'],
    ])
    expect(todo.slice(-2)).toEqual([
      ['Clean the bathroom', 'Saturday'],
      ['Call the dentist', 'In the bank'],
    ])
    expect(todo.map(([title]) => title)).not.toContain('Plan the week')
    expect(todo.map(([title]) => title)).not.toContain('Laundry')
    expect(todo.map(([title]) => title)).not.toContain('Lift: bench day')
  })

  it('only shows: the one control on the page is the way back', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<Upkeep today={WEDNESDAY_DAY} onBack={onBack} />)
    await screen.findByRole('region', { name: 'To do' })

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Back to Aspirations',
    ])
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to Aspirations' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('says so when there is nothing on either side', async () => {
    vi.mocked(getUpkeep).mockResolvedValueOnce({ recurringItems: [], tasks: [] })
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    expect(await screen.findByText('No recurring items.')).toBeDefined()
    expect(screen.getByText('Nothing waiting.')).toBeDefined()
  })

  it('says so calmly when loading fails, and still offers the way back', async () => {
    vi.mocked(getUpkeep).mockRejectedValueOnce(new Error('offline'))
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    expect((await screen.findByRole('status')).textContent).toBe("Couldn't load this page. Try again in a moment.")
    expect(screen.getByRole('button', { name: 'Back to Aspirations' })).toBeDefined()
  })
})
