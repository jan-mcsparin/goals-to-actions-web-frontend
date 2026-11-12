import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, getAspirations, getBank, getDay } from '../api/client.ts'
import { resetStore, store } from '../api/mockStore.ts'
import type { AddOrigin, OnSaved } from '../hooks/useAdd.ts'
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
type HarnessProps = { opening: AddOrigin; onSaved: OnSaved; onChanged: () => void }

function Harness({ opening, onSaved, onChanged }: HarnessProps) {
  const [origin, setOrigin] = useState<AddOrigin>()
  return (
    <>
      <button type="button" onClick={() => setOrigin(opening)}>
        Open
      </button>
      <AddSheet
        origin={origin}
        today={TODAY}
        onSaved={(...saved) => {
          setOrigin(undefined)
          onSaved(...saved)
        }}
        onChanged={onChanged}
        onClose={() => setOrigin(undefined)}
      />
    </>
  )
}

async function openSheet(placement: AddOrigin['placement'] = 'inBank', opening: Partial<AddOrigin> = {}) {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  const onChanged = vi.fn()
  render(<Harness opening={{ placement, ...opening }} onSaved={onSaved} onChanged={onChanged} />)
  await user.click(screen.getByRole('button', { name: 'Open' }))
  return { user, onSaved, onChanged }
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

// Finds the one element that reads exactly this, however its text is split
// across tags ("Label:" is bold, the label isn't).
function readsAs(text: string) {
  return (_: string, element: Element | null) => element?.textContent === text
}

describe('AddSheet on the Goal tab', () => {
  async function openGoalTab() {
    const opened = await openSheet()
    await opened.user.click(screen.getByRole('button', { name: 'Goal' }))
    return opened
  }

  it('shows only the three types until one is picked, leaving focus on the tab', async () => {
    await openGoalTab()

    const types = screen.getByRole('group', { name: 'Type' })
    expect(Array.from(types.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['Building', 'Quitting', 'One-off'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Goal' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it("doesn't move focus into the sentence when a type is picked, so no keyboard comes up", async () => {
    const { user } = await openGoalTab()

    await user.click(screen.getByRole('button', { name: 'Building' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Building' }))
  })

  it('shows the label and line back as the sentence is typed', async () => {
    const { user } = await openGoalTab()
    await user.click(screen.getByRole('button', { name: 'Building' }))

    await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Be strong 2: bench 185')

    const parts = document.getElementById(screen.getByRole('textbox', { name: 'Goal' }).getAttribute('aria-describedby')!)!
    expect(within(parts).getByText(readsAs('Label: Be strong 2'))).toBeDefined()
    expect(within(parts).getByText(readsAs('Line: bench 185'))).toBeDefined()
    expect(screen.queryByRole('textbox', { name: "How will you know you've got there?" })).toBeNull()
  })

  it('asks for the line in a second field when there is no colon, and needs both', async () => {
    const { user } = await openGoalTab()
    await user.click(screen.getByRole('button', { name: 'Quitting' }))

    await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Quit sugar')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox', { name: "How will you know you've got there?" }), '30 days without')

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false)
  })

  it("shows each type's own fields, and the type can be changed", async () => {
    const { user } = await openGoalTab()

    await user.click(screen.getByRole('button', { name: 'Building' }))
    expect(screen.getByRole('textbox', { name: 'Weekly target (optional)' })).toBeDefined()
    expect(screen.queryByLabelText('Start date')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Quitting' }))
    expect(screen.getByRole('button', { name: 'Quitting' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('textbox', { name: 'Weekly target (optional)' })).toBeNull()
    expect(screen.getByLabelText('Start date')).toHaveProperty('value', TODAY)

    await user.click(screen.getByRole('button', { name: 'One-off' }))
    expect(screen.queryByLabelText('Start date')).toBeNull()
    expect(screen.getByLabelText('Deadline (optional)')).toBeDefined()
  })

  it('saves a building goal with its aspiration, baseline, target and deadline, and opens it', async () => {
    const { user, onSaved } = await openGoalTab()
    await user.click(screen.getByRole('button', { name: 'Building' }))
    await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Be strong 2: bench 185')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Be fit' })).toBeDefined())

    await user.selectOptions(screen.getByRole('combobox', { name: "What's this for?" }), 'Be fit')
    await user.type(screen.getByRole('textbox', { name: 'Where are you now? (optional)' }), 'bench 165')
    await user.type(screen.getByRole('textbox', { name: 'Weekly target (optional)' }), '3')
    await user.type(screen.getByRole('textbox', { name: 'Unit' }), 'lifting sessions')
    await user.type(screen.getByLabelText('Deadline (optional)'), '2027-06-01')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const goal = store.goals.find((row) => row.label === 'Be strong 2')!
    expect(goal).toMatchObject({ measurableLine: 'bench 185', aspirationId: 'asp-fit', baseline: 'bench 165', deadline: '2027-06-01' })
    expect(store.weeklyTargets.find((target) => target.goalId === goal.id)).toMatchObject({ amount: 3, unit: 'lifting sessions' })
    expect(onSaved).toHaveBeenCalledWith("Saved. Add milestones when you're ready.", {
      screen: 'goal',
      goalId: goal.id,
      from: { screen: 'aspiration', aspirationId: 'asp-fit' },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('creates a new aspiration with the goal', async () => {
    const { user, onSaved } = await openGoalTab()
    await user.click(screen.getByRole('button', { name: 'One-off' }))
    await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Host Thanksgiving: 12 people fed')

    await user.selectOptions(screen.getByRole('combobox', { name: "What's this for?" }), 'New aspiration')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox', { name: 'Aspiration name' }), 'Be generous')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    expect(store.goals.find((row) => row.label === 'Host Thanksgiving')?.aspirationId).toBe(aspiration.id)
    expect(onSaved).toHaveBeenCalledWith("Saved. Add steps when you're ready.", expect.objectContaining({ screen: 'goal' }))
  })

  it('keeps the goal typed when switching tabs', async () => {
    const { user } = await openGoalTab()
    await user.click(screen.getByRole('button', { name: 'Building' }))
    await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Be strong 2: bench 185')

    await user.click(screen.getByRole('button', { name: 'Task' }))
    await user.click(screen.getByRole('button', { name: 'Goal' }))

    expect(screen.getByRole('button', { name: 'Building' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveProperty('value', 'Be strong 2: bench 185')
  })
})

describe('AddSheet opened for an aspiration', () => {
  it('opens on the Goal tab with it selected', async () => {
    const { user } = await openSheet('inBank', { tab: 'goal', aspirationId: 'asp-fit' })

    expect(screen.getByRole('button', { name: 'Goal' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Building' }))
    await user.click(screen.getByRole('button', { name: 'Building' }))
    await screen.findByRole('option', { name: 'Be fit' })
    expect(screen.getByRole('combobox', { name: "What's this for?" })).toHaveProperty('value', 'asp-fit')
  })
})

describe('AddSheet on the Aspiration tab', () => {
  async function openAspirationTab() {
    const opened = await openSheet()
    await opened.user.click(screen.getByRole('button', { name: 'Aspiration' }))
    return opened
  }

  it('asks for a name and a why, leaving focus on the tab, with Save off until it has a name', async () => {
    const { user } = await openAspirationTab()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Aspiration' }))
    expect(screen.getByRole('textbox', { name: 'What would this give you? (optional)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Be generous')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false)
  })

  it('saves without a why and stays open on "Saved.", then Done closes it', async () => {
    const { user, onSaved, onChanged } = await openAspirationTab()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Be generous')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(store.aspirations.find((row) => row.name === 'Be generous')?.why).toBeUndefined()
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByText('Saved.')).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add a goal for this' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the Goal tab with the new aspiration selected from "Add a goal for this"', async () => {
    const { user } = await openAspirationTab()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Be generous')
    await user.type(screen.getByRole('textbox', { name: 'What would this give you? (optional)' }), 'So the people I love feel it')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Add a goal for this' }))
    await user.click(screen.getByRole('button', { name: 'Building' }))

    const aspiration = store.aspirations.find((row) => row.name === 'Be generous')!
    expect(aspiration.why).toBe('So the people I love feel it')
    expect(screen.getByRole('button', { name: 'Goal' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('combobox', { name: "What's this for?" })).toHaveProperty('value', aspiration.id)
  })
})
