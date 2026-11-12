import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStore } from '../api/mockStore.ts'
import { Settings } from './Settings.tsx'

beforeEach(() => {
  resetStore()
})

// The value shown beside a row's label.
function rowValue(label: string) {
  return screen.getByText(label).nextElementSibling
}

describe('Settings', () => {
  it('pins the way back and the heading at the top', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<Settings onBack={onBack} />)

    const heading = screen.getByRole('heading', { level: 1, name: 'Settings' })
    const top = heading.closest('.screen-top') as HTMLElement
    expect(within(top).getByRole('button', { name: 'Back to Aspirations' }).textContent).toBe('‹ Aspirations')

    await user.click(within(top).getByRole('button', { name: 'Back to Aspirations' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows Week starts Monday and Notifications Off, neither a control', () => {
    render(<Settings onBack={() => {}} />)

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
