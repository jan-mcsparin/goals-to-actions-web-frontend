import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SignedOutError } from '../api/errors.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load that."

describe('useLoaded', () => {
  it('reports a failed load', async () => {
    const load = () => Promise.reject(new Error('GET /x: 500'))
    const { result } = renderHook(() => useLoaded(load, LOAD_FAILED))

    await waitFor(() => expect(result.current.message).toBe(LOAD_FAILED))
  })

  it('says nothing when signed out: the sign-in page is the message', async () => {
    let failed = false
    const load = () => {
      failed = true
      return Promise.reject(new SignedOutError('GET /x: 401'))
    }
    const { result } = renderHook(() => useLoaded(load, LOAD_FAILED))

    await waitFor(() => expect(failed).toBe(true))
    await Promise.resolve()
    expect(result.current.message).toBeUndefined()
    expect(result.current.notFound).toBe(false)
  })
})
