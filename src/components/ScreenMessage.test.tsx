import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScreenMessage } from './ScreenMessage.tsx'

describe('ScreenMessage', () => {
  it('renders nothing without a message', () => {
    render(<ScreenMessage onDismiss={() => {}} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('announces the message', () => {
    render(<ScreenMessage message="Couldn't save that. Try again." onDismiss={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe("Couldn't save that. Try again.")
  })

  it('is dismissed with a tap', async () => {
    const onDismiss = vi.fn()
    render(<ScreenMessage message="Couldn't save that. Try again." onDismiss={onDismiss} />)

    await userEvent.click(screen.getByRole('button', { name: "Couldn't save that. Try again." }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
