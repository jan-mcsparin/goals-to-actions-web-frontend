import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

function Broken(): never {
  throw new Error('bad data')
}

// React reports caught errors on the console; the tests expect them.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('shows what it wraps when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>Fine</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Fine')).toBeDefined()
  })

  it('shows a calm message and a way out in place of what failed', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong showing this.')).toBeDefined()
    expect(screen.getByText('Try another tab, or reload.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined()
  })

  it('reloads the app when Reload is tapped', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    render(
      <ErrorBoundary reload={reload}>
        <Broken />
      </ErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
