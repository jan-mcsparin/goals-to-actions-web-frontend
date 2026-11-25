import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRecurringItem, getUpkeep, updateRecurringItem } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Upkeep } from './Upkeep.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return {
    ...actual,
    deleteRecurringItem: vi.fn(actual.deleteRecurringItem),
    getUpkeep: vi.fn(actual.getUpkeep),
    updateRecurringItem: vi.fn(actual.updateRecurringItem),
  }
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

// For the tests that wait out a message: timeouts are faked too, and still
// run on their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
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

  it('opens only recurring items: the tasks just show, besides the way back', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<Upkeep today={WEDNESDAY_DAY} onBack={onBack} />)
    await screen.findByRole('region', { name: 'To do' })

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
      'Back to Aspirations',
      'Pay rentMonthly on the 1st',
    ])
    expect(within(screen.getByRole('region', { name: 'To do' })).queryByRole('button')).toBeNull()
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

    const message = await screen.findByRole('status')
    expect(message.className).toBe('screen-message')
    expect(message.textContent).toBe("Couldn't load this page. Try again in a moment.")
    expect(screen.getByRole('button', { name: 'Back to Aspirations' })).toBeDefined()
  })

  it("keeps a load failure until it's tapped", async () => {
    fakeTimeouts()
    vi.mocked(getUpkeep).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)

    const message = await screen.findByRole('button', { name: "Couldn't load this page. Try again in a moment." })
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBeDefined()

    await user.click(message)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Keep life running, a recurring item', () => {
  async function openRent() {
    const user = userEvent.setup()
    render(<Upkeep today={WEDNESDAY_DAY} onBack={() => {}} />)
    const recurring = await screen.findByRole('region', { name: 'Recurring' })
    await user.click(within(recurring).getByRole('button', { name: /Pay rent/ }))
    return { user, recurring, sheet: screen.getByRole('dialog', { name: 'Edit recurring item' }) }
  }

  it('opens filled in, with Save off until something changes', async () => {
    const { user, sheet } = await openRent()

    expect((within(sheet).getByLabelText('Name') as HTMLInputElement).value).toBe('Pay rent')
    expect((within(sheet).getByLabelText('Day') as HTMLSelectElement).value).toBe('monthly:1')
    const save = within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    await user.type(within(sheet).getByLabelText('Name'), ' and utilities')

    expect(save.disabled).toBe(false)
  })

  it('saves a new name and shows it on the row', async () => {
    const { user, recurring, sheet } = await openRent()

    await user.type(within(sheet).getByLabelText('Name'), ' and utilities')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(rows(recurring)).toEqual([['Pay rent and utilities', 'Monthly on the 1st']]))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('takes the row off the list once it moves under an aspiration', async () => {
    const { user, recurring, sheet } = await openRent()

    await user.selectOptions(within(sheet).getByLabelText('Under an aspiration (optional)'), await within(sheet).findByRole('option', { name: 'Be fit' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(recurring).getByText('No recurring items.')).toBeDefined())
  })

  it('pauses it at once, and keeps it listed as Paused', async () => {
    const { user, recurring, sheet } = await openRent()

    await user.click(within(sheet).getByRole('button', { name: 'Pause' }))

    await waitFor(() => expect(rows(recurring)).toEqual([['Pay rent', 'Paused']]))
  })

  it('keeps the sheet and what was typed when the save fails', async () => {
    vi.mocked(updateRecurringItem).mockRejectedValueOnce(new Error('offline'))
    const { user, sheet } = await openRent()

    await user.type(within(sheet).getByLabelText('Name'), ' and utilities')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(await within(sheet).findByText("Couldn't save that. Try again.")).toBeDefined()
    expect((within(sheet).getByLabelText('Name') as HTMLInputElement).value).toBe('Pay rent and utilities')
  })

  it('deletes it, last in the sheet under Pause, after asking once', async () => {
    const { user, recurring, sheet } = await openRent()

    const buttons = within(sheet).getAllByRole('button')
    expect(buttons.slice(-2).map((button) => button.textContent)).toEqual(['Pause', 'Delete'])
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    const asking = screen.getByRole('dialog', {
      name: 'Delete “Pay rent”? Its open tasks go with it; the ones done stay in your history.',
    })
    expect(deleteRecurringItem).not.toHaveBeenCalled()
    await user.click(within(asking).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(within(recurring).getByText('No recurring items.')).toBeDefined())
    expect(deleteRecurringItem).toHaveBeenCalledExactlyOnceWith('rec-rent')
  })

  it("comes back to its sheet with a message when it can't be deleted", async () => {
    vi.mocked(deleteRecurringItem).mockRejectedValueOnce(new Error('offline'))
    const { user, recurring, sheet } = await openRent()

    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog', { name: /^Delete “Pay rent”/ })).getByRole('button', { name: 'Delete' }))

    expect(await within(sheet).findByText("Couldn't delete that. Try again.")).toBeDefined()
    expect(rows(recurring)).toEqual([['Pay rent', 'Monthly on the 1st']])
  })
})
