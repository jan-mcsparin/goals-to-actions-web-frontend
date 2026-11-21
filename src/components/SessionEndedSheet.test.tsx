import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SessionEndedSheet } from './SessionEndedSheet.tsx'

function sheet() {
  return screen.getByRole('dialog', { name: 'Sign in to keep saving' })
}

describe('SessionEndedSheet', () => {
  it.each([
    [0, 'Everything you did is safe on this phone.'],
    [1, "Everything you did is safe on this phone: 1 change will send as soon as you're back in."],
    [3, "Everything you did is safe on this phone: 3 changes will send as soon as you're back in."],
  ])('with %i waiting, says what is safe', (waiting, line) => {
    render(<SessionEndedSheet open waiting={waiting} onSignIn={() => {}} onNotNow={() => {}} />)

    expect(within(sheet()).getByText(line)).toBeDefined()
  })

  it('signs in, or closes with Not now', async () => {
    const onSignIn = vi.fn()
    const onNotNow = vi.fn()
    const user = userEvent.setup()
    render(<SessionEndedSheet open waiting={2} onSignIn={onSignIn} onNotNow={onNotNow} />)

    await user.click(within(sheet()).getByRole('button', { name: 'Sign in with Face ID' }))
    expect(onSignIn).toHaveBeenCalledOnce()

    await user.click(within(sheet()).getByRole('button', { name: 'Not now' }))
    expect(onNotNow).toHaveBeenCalled()
  })

  it('shows what didn’t finish, calmly, and holds the button while signing in', () => {
    render(
      <SessionEndedSheet
        open
        waiting={0}
        busy
        message="Sign-in didn't finish. Try again when you're ready."
        onSignIn={() => {}}
        onNotNow={() => {}}
      />,
    )

    expect(within(sheet()).getByRole('status').textContent).toBe("Sign-in didn't finish. Try again when you're ready.")
    expect(within(sheet()).getByRole('button', { name: 'Sign in with Face ID' }).hasAttribute('disabled')).toBe(true)
  })
})
