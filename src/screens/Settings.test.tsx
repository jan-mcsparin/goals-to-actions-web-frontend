import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSettings, setIntensity } from '../api/client.ts'
import { resetStore } from '../api/mockStore.ts'
import { Settings } from './Settings.tsx'

vi.mock('../api/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.ts')>()
  return { ...actual, getSettings: vi.fn(actual.getSettings), setIntensity: vi.fn(actual.setIntensity) }
})

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getSettings).mockClear()
  vi.mocked(setIntensity).mockClear()
})

// For the tests that wait out a message: timeouts are faked, and still run on
// their own so RTL's polling works.
function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
}

// The value shown beside a row's label.
function rowValue(label: string) {
  return screen.getByText(label).nextElementSibling
}

function checkedIntensity() {
  const radios = screen.getAllByRole('radio') as HTMLInputElement[]
  return radios.find((radio) => radio.checked)?.closest('label')?.textContent
}

describe('Settings', () => {
  it('pins the way back and the heading at the top', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<Settings onBack={onBack} onSignOut={() => {}} />)

    const heading = screen.getByRole('heading', { level: 1, name: 'Settings' })
    const top = heading.closest('.screen-top') as HTMLElement
    expect(within(top).getByRole('button', { name: 'Back to Aspirations' }).textContent).toBe('‹ Aspirations')

    await user.click(within(top).getByRole('button', { name: 'Back to Aspirations' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows Week starts Monday and Notifications Off, neither a control', () => {
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    expect(rowValue('Week starts')?.textContent).toBe('Monday')
    expect(rowValue('Notifications')?.textContent).toBe('Off')
    for (const label of ['Week starts', 'Notifications']) {
      const row = screen.getByText(label).parentElement!
      expect(within(row).queryByRole('button')).toBeNull()
      expect(within(row).queryByRole('radio')).toBeNull()
      expect(within(row).queryByRole('checkbox')).toBeNull()
    }
  })
})

describe('Settings, intensity', () => {
  it('offers the three intensities in a row, with Normal selected at first', async () => {
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    const group = await screen.findByRole('radiogroup', { name: 'Intensity' })
    expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Easing off',
      'Normal',
      'Going hard',
    ])
    expect(checkedIntensity()).toBe('Normal')
    expect(screen.getByText('Sets how full days are and how much is free.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('saves a tapped intensity at once', async () => {
    const user = userEvent.setup()
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    await user.click(await screen.findByRole('radio', { name: 'Going hard' }))

    expect(checkedIntensity()).toBe('Going hard')
    expect(setIntensity).toHaveBeenCalledWith('goingHard')
  })

  it('moves the choice with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    await user.click(await screen.findByRole('radio', { name: 'Normal' }))
    await user.keyboard('{ArrowRight}')

    expect(checkedIntensity()).toBe('Going hard')
    expect(setIntensity).toHaveBeenLastCalledWith('goingHard')
  })

  it('goes back to the earlier choice, with a message, when the save fails', async () => {
    vi.mocked(setIntensity).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    await user.click(await screen.findByRole('radio', { name: 'Easing off' }))

    expect((await screen.findByRole('status')).textContent).toBe("Couldn't save that. Try again.")
    expect(checkedIntensity()).toBe('Normal')
  })
})

describe('Settings, export', () => {
  it('says export is coming later, and says it again after it clears', async () => {
    fakeTimeouts()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)
    const exportRow = await screen.findByRole('button', { name: 'Export my data' })

    await user.click(exportRow)
    expect((await screen.findByRole('status')).textContent).toBe('Coming later.')

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()

    await user.click(exportRow)
    expect((await screen.findByRole('status')).textContent).toBe('Coming later.')
  })
})

describe('Settings, when it can’t load', () => {
  it('keeps the message until tapped, with the header and fixed rows still there', async () => {
    fakeTimeouts()
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    const message = await screen.findByRole('status')
    expect(message.textContent).toBe("Couldn't load settings. Try again in a moment.")
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()
    expect(rowValue('Week starts')?.textContent).toBe('Monday')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export my data' })).toBeNull()

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('status')).toBe(message)

    await user.click(within(message).getByRole('button'))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Settings, signing out', () => {
  it('asks once, saying what is cleared and what stays, then signs out', async () => {
    const onSignOut = vi.fn()
    const user = userEvent.setup()
    render(<Settings onBack={() => {}} onSignOut={onSignOut} />)

    expect(screen.getByRole('heading', { name: 'Account' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    const sheet = screen.getByRole('dialog', { name: 'Sign out of this device?' })
    expect(sheet.textContent).toContain("This clears what's stored on this device.")
    expect(sheet.textContent).toContain('stay safe on the server')
    expect(onSignOut).not.toHaveBeenCalled()

    await user.click(within(sheet).getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('changes nothing on Cancel', async () => {
    const onSignOut = vi.fn()
    const user = userEvent.setup()
    render(<Settings onBack={() => {}} onSignOut={onSignOut} />)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onSignOut).not.toHaveBeenCalled()
  })

  it('holds the sheet’s Sign out while signing out', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Settings onBack={() => {}} onSignOut={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    rerender(<Settings onBack={() => {}} onSignOut={() => {}} signingOut />)

    const sheet = screen.getByRole('dialog', { name: 'Sign out of this device?' })
    expect(within(sheet).getByRole('button', { name: 'Sign out' }).hasAttribute('disabled')).toBe(true)
  })

  it('offers sign out even when settings can’t load', async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('offline'))
    render(<Settings onBack={() => {}} onSignOut={() => {}} />)

    await screen.findByRole('status')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined()
  })
})
