import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StillMattersCard } from './StillMattersCard.tsx'

function renderCard() {
  const handlers = { onKeep: vi.fn(), onReschedule: vi.fn(), onDrop: vi.fn(), onNotNow: vi.fn() }
  render(<StillMattersCard title="Call the dentist" {...handlers} />)
  return handlers
}

describe('StillMattersCard', () => {
  it('asks about the task, in a group named for it', () => {
    renderCard()

    expect(screen.getByRole('group', { name: 'Still matter? Call the dentist' })).toBeDefined()
    expect(screen.getByText('Still matter?')).toBeDefined()
    expect(screen.getByText('Call the dentist')).toBeDefined()
  })

  it.each([
    ['Keep', 'onKeep'],
    ['Reschedule', 'onReschedule'],
    ['Drop', 'onDrop'],
    ['Not now', 'onNotNow'],
  ] as const)('%s calls its handler once', async (name, handler) => {
    const handlers = renderCard()

    await userEvent.click(screen.getByRole('button', { name }))

    expect(handlers[handler]).toHaveBeenCalledOnce()
  })

  it('has no shame language and no counts of weeks', () => {
    renderCard()

    expect(document.body.textContent).not.toMatch(/missed|overdue|failed|behind|weeks?\b|\d/i)
  })
})
