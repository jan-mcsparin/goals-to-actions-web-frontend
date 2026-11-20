import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SignInStep, UseSession } from '../hooks/useSession.ts'
import { SignIn } from './SignIn.tsx'

function session(step: SignInStep, overrides: Partial<UseSession> = {}): UseSession {
  return {
    signedIn: false,
    step,
    busy: false,
    message: undefined,
    signIn: vi.fn(async () => {}),
    enterCode: vi.fn(),
    submitCode: vi.fn(async () => {}),
    addPasskey: vi.fn(async () => {}),
    back: vi.fn(),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('SignIn', () => {
  describe('sign in', () => {
    it('shows the name, the line and one action', () => {
      render(<SignIn session={session('signIn')} />)

      expect(screen.getByRole('heading', { level: 1, name: 'Goals to Actions' })).toBeDefined()
      expect(screen.getByText('Small steps today toward who you want to be.')).toBeDefined()
      expect(screen.getByText('No password. Your passkey stays on your devices.')).toBeDefined()
    })

    it('signs in with a passkey', async () => {
      const shown = session('signIn')
      render(<SignIn session={shown} />)

      await userEvent.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))

      expect(shown.signIn).toHaveBeenCalledOnce()
    })

    it('opens the code step for a new device', async () => {
      const shown = session('signIn')
      render(<SignIn session={shown} />)

      await userEvent.click(screen.getByRole('button', { name: 'New device? Use a one-time code' }))

      expect(shown.enterCode).toHaveBeenCalledOnce()
    })

    it('shows a message calmly, as status, not an alert', () => {
      render(<SignIn session={session('signIn', { message: "Sign-in didn't finish. Try again when you're ready." })} />)

      expect(screen.getByRole('status').textContent).toBe("Sign-in didn't finish. Try again when you're ready.")
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('holds its buttons while busy', () => {
      render(<SignIn session={session('signIn', { busy: true })} />)

      expect(screen.getByRole('button', { name: 'Sign in with Face ID' }).hasAttribute('disabled')).toBe(true)
      expect(screen.getByRole('button', { name: 'New device? Use a one-time code' }).hasAttribute('disabled')).toBe(true)
    })
  })

  describe('one-time code', () => {
    it('sends the code typed', async () => {
      const shown = session('code')
      render(<SignIn session={shown} />)

      expect(screen.getByRole('heading', { name: 'Enter your one-time code' })).toBeDefined()
      const field = screen.getByLabelText('One-time code')
      expect(field.getAttribute('autocomplete')).toBe('one-time-code')
      await userEvent.type(field, '9F3K-ABCD')
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

      expect(shown.submitCode).toHaveBeenCalledWith('9F3K-ABCD')
    })

    it('sends it with Return too', async () => {
      const shown = session('code')
      render(<SignIn session={shown} />)

      await userEvent.type(screen.getByLabelText('One-time code'), '9F3K{Enter}')

      expect(shown.submitCode).toHaveBeenCalledWith('9F3K')
    })

    it('ties the message to the field', () => {
      const message = "That code didn't work. It may already have been used, or be more than ten minutes old. Ask for a new one."
      render(<SignIn session={session('code', { message })} />)

      const field = screen.getByLabelText('One-time code')
      expect(field.getAttribute('aria-invalid')).toBe('true')
      expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe(message)
    })

    it('goes back', async () => {
      const shown = session('code')
      render(<SignIn session={shown} />)

      await userEvent.click(screen.getByRole('button', { name: 'Back' }))

      expect(shown.back).toHaveBeenCalledOnce()
    })
  })

  describe('add a passkey', () => {
    it('says the code worked and adds the passkey, with no tester note', async () => {
      const shown = session('addPasskey')
      render(<SignIn session={shown} />)

      expect(screen.getByText('Code accepted')).toBeDefined()
      expect(screen.getByRole('heading', { name: 'Add a passkey to this device' })).toBeDefined()
      expect(document.body.textContent).not.toMatch(/testing/i)
      await userEvent.click(screen.getByRole('button', { name: 'Add passkey' }))

      expect(shown.addPasskey).toHaveBeenCalledOnce()
    })
  })

  it('has no error tone in any step', () => {
    for (const step of ['signIn', 'code', 'addPasskey'] as const) {
      const { unmount } = render(<SignIn session={session(step)} />)
      expect(document.body.textContent).not.toMatch(/error|failed|invalid|denied/i)
      unmount()
    }
  })
})
