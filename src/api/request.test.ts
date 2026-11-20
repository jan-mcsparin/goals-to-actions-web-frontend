import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, SignedOutError } from './errors.ts'
import { request } from './request.ts'
import { onSignedOut } from './session.ts'

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('sends the phone’s time zone and JSON to /api', async () => {
    fetchMock.mockResolvedValue(respond(200, { aspirations: [] }))

    await request('GET', '/aspirations')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aspirations')
    expect(init?.method).toBe('GET')
    const headers = new Headers(init?.headers)
    expect(headers.get('X-Time-Zone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(headers.get('Accept')).toBe('application/json')
    expect(init?.body).toBeUndefined()
  })

  it('sends a camelCase body and returns the reply as it comes, with no renaming', async () => {
    const reply = { id: 'a1', retiredOn: null, createdAt: '2026-11-11T09:00:00Z' }
    fetchMock.mockResolvedValue(respond(200, reply))

    const result = await request('PUT', '/aspirations/a1', { name: 'Be fit', why: null })

    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"name":"Be fit","why":null}')
    expect(result).toEqual(reply)
  })

  it('turns a 404 into NotFoundError', async () => {
    fetchMock.mockResolvedValue(respond(404, { detail: 'No aspiration a1' }))

    await expect(request('PATCH', '/aspirations/a1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([403, 409, 422, 500])('turns a %i into a failed request, not NotFoundError', async (status) => {
    fetchMock.mockResolvedValue(respond(status, { detail: 'No' }))

    const failure = request('POST', '/aspirations/reorder', { ids: [] })

    await expect(failure).rejects.toThrow(String(status))
    await expect(failure).rejects.not.toBeInstanceOf(NotFoundError)
  })

  it('turns a network failure into a failed request, not NotFoundError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const failure = request('GET', '/aspirations')

    await expect(failure).rejects.toThrow()
    await expect(failure).rejects.not.toBeInstanceOf(NotFoundError)
  })

  describe('a 401', () => {
    const listener = vi.fn()
    let stopListening: () => void

    beforeEach(() => {
      listener.mockReset()
      stopListening = onSignedOut(listener)
    })

    afterEach(() => stopListening())

    it('is SignedOutError and tells the session', async () => {
      fetchMock.mockResolvedValue(respond(401, { detail: 'Not signed in' }))

      await expect(request('GET', '/aspirations')).rejects.toBeInstanceOf(SignedOutError)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('from a sign-in route is SignedOutError and tells no one: it means that didn’t work', async () => {
      fetchMock.mockResolvedValue(respond(401, { detail: "That didn't work" }))

      await expect(request('POST', '/sign-in/finish', {})).rejects.toBeInstanceOf(SignedOutError)
      expect(listener).not.toHaveBeenCalled()
    })
  })
})
