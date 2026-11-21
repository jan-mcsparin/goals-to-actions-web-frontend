import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SignedOutBanner } from './SignedOutBanner.tsx'

describe('SignedOutBanner', () => {
  it.each([
    [0, 'Not signed in'],
    [1, 'Not signed in · 1 change waiting'],
    [3, 'Not signed in · 3 changes waiting'],
  ])('with %i waiting, reads “%s”', (waiting, line) => {
    render(<SignedOutBanner waiting={waiting} onSignIn={() => {}} />)

    expect(screen.getByText(line)).toBeDefined()
  })

  it('opens the passkey from Sign in, held while signing in', async () => {
    const onSignIn = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<SignedOutBanner waiting={3} onSignIn={onSignIn} />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(onSignIn).toHaveBeenCalledOnce()

    rerender(<SignedOutBanner waiting={3} busy onSignIn={onSignIn} />)
    expect(screen.getByRole('button', { name: 'Sign in' }).hasAttribute('disabled')).toBe(true)
  })
})
