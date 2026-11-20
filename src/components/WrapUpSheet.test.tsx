import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WrapUpSheet } from './WrapUpSheet.tsx'

function renderSheet(props: Partial<React.ComponentProps<typeof WrapUpSheet>> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <WrapUpSheet
      open
      carriesOver={['Call the dentist', 'Mow the lawn']}
      ends={['Lift: deadlift day']}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  )
  return { onConfirm, onClose }
}

describe('WrapUpSheet', () => {
  it('lists what carries over and what ends with the week', () => {
    renderSheet()

    const carries = screen.getByRole('region', { name: 'Carries over to next week' })
    expect(within(carries).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Call the dentist',
      'Mow the lawn',
    ])
    const ends = screen.getByRole('region', { name: 'Ends with this week' })
    expect(within(ends).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Lift: deadlift day'])
  })

  it("leaves out a list that's empty", () => {
    renderSheet({ ends: [] })

    expect(screen.getByRole('region', { name: 'Carries over to next week' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Ends with this week' })).toBeNull()
  })

  it('says so when there is nothing left to carry or end', () => {
    renderSheet({ carriesOver: [], ends: [] })

    expect(screen.getByText('Everything is done. Nothing to carry over.')).toBeDefined()
  })

  it('warns once that it can’t be undone, and never mentions misses', () => {
    renderSheet()

    expect(screen.getByText(/can.t be undone/)).toBeDefined()
    expect(document.body.textContent).not.toMatch(/missed|failed|overdue|behind|didn.t/i)
  })

  it('confirms, or closes without changing anything', async () => {
    const { onConfirm, onClose } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Wrap up this week' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
