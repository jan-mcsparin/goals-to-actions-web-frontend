import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSettings, setIntensity } from './realSettings.ts'

const fetchMock = vi.fn<typeof fetch>()

function sent(call = 0) {
  const [url, init] = fetchMock.mock.calls[call]
  return { url, method: init?.method, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ intensity: 'goingHard' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('settings', () => {
  it('reads them', async () => {
    expect(await getSettings()).toEqual({ intensity: 'goingHard' })
    expect(sent()).toEqual({ url: '/api/settings', method: 'GET', body: undefined })
  })

  it('sets the intensity', async () => {
    expect(await setIntensity('goingHard')).toEqual({ intensity: 'goingHard' })
    expect(sent()).toEqual({ url: '/api/settings/intensity', method: 'PUT', body: { intensity: 'goingHard' } })
  })
})
