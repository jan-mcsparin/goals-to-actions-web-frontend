import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, getAspirations, getBank, getDay } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import type { AddOrigin } from '../hooks/useAdd.ts'
import { AddSheet } from './AddSheet.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, addTask: vi.fn(actual.addTask), getAspirations: vi.fn(actual.getAspirations) }
})

const TODAY = '2026-11-11'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9, 0))
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

// Opens and closes the sheet the way App does.
function Harness({ placement, onSaved }: { placement: AddOrigin['placement']; onSaved: (line: string) => void }) {
  const [origin, setOrigin] = useState<AddOrigin>()
  return (
    <>
      <button type="button" onClick={() => setOrigin({ placement })}>
        Open
      </button>
      <AddSheet
        origin={origin}
        today={TODAY}
        onSaved={(line) => {
          setOrigin(undefined)
          onSaved(line)
        }}
        onClose={() => setOrigin(undefined)}
      />
    </>
  )
}

async function openSheet(placement: AddOrigin['placement'] = 'inBank') {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  render(<Harness placement={placement} onSaved={onSaved} />)
  await user.click(screen.getByRole('button', { name: 'Open' }))
  return { user, onSaved }
}

describe('AddSheet', () => {
  it('opens titled Add on the Task tab, with the title field focused and Save disabled', async () => {
    await openSheet()

    expect(screen.getByRole('dialog', { name: 'Add' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Task' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }))
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
  })

  it('starts in the bank, or on today when opened for today', async () => {
    await openSheet('inBank')
    expect(screen.getByRole('radio', { name: 'In the bank' })).toHaveProperty('checked', true)
  })

  it('starts on today when opened for today', async () => {
    await openSheet('onToday')
    expect(screen.getByRole('radio', { name: 'On today' })).toHaveProperty('checked', true)
  })

  it("saves a title alone to this week's bank and closes", async () => {
    const { user, onSaved } = await openSheet()

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Fill out my ballot')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaved).toHaveBeenCalledWith("Added to this week's bank.")
    expect((await getBank()).tasks.map((task) => task.title)).toContain('Fill out my ballot')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('saves the goal, due date, time of day and "On today"', async () => {
    const { user, onSaved } = await openSheet()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Book a gym class')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Be strong' })).toBeDefined())

    await user.selectOptions(screen.getByRole('combobox', { name: 'Goal' }), 'Be strong')
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-11-13')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day (optional)' }), 'By')
    await user.type(screen.getByLabelText('Time'), '18:00')
    await user.click(screen.getByRole('radio', { name: 'On today' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaved).toHaveBeenCalledWith('Added to today.')
    const added = (await getDay(TODAY)).tasks.find((task) => task.title === 'Book a gym class')
    expect(added).toMatchObject({
      goalId: 'goal-strong',
      dueDate: '2026-11-13',
      timeOfDay: { kind: 'by', time: '18:00' },
      placedByHand: true,
    })
  })

  it('asks for a time only once "By" or "At" is chosen', async () => {
    const { user } = await openSheet()

    expect(screen.queryByLabelText('Time')).toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day (optional)' }), 'At')

    expect(screen.getByLabelText('Time')).toBeDefined()
  })

  it('keeps what was typed when switching tabs, and starts over after closing', async () => {
    const { user } = await openSheet()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Fill out my ballot')

    await user.click(screen.getByRole('button', { name: 'Goal' }))
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Task' }))
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Fill out my ballot')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty('value', '')
  })

  it("says so under the goal picker when the goals can't load", async () => {
    vi.mocked(getAspirations).mockRejectedValueOnce(new Error('offline'))
    await openSheet()

    expect(await screen.findByText("Couldn't load your goals. Try again in a moment.")).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Goal' }).getAttribute('aria-describedby')).toBe(
      screen.getByText("Couldn't load your goals. Try again in a moment.").id,
    )
  })

  it('stays open with what was typed and a calm message when the save fails', async () => {
    vi.mocked(addTask).mockRejectedValueOnce(new Error('offline'))
    const { user, onSaved } = await openSheet()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Fill out my ballot')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe("Couldn't save that. Try again.")
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Fill out my ballot')
  })
})
