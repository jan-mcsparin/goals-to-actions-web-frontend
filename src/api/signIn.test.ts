import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignedOutError } from './errors.ts'
import { request } from './request.ts'
import type { PasskeyOptions } from './types.ts'

vi.mock('./request.ts', () => ({ request: vi.fn() }))
const mode = vi.hoisted(() => ({ realApi: true }))
vi.mock('./mode.ts', () => mode)

const { addPasskey, redeemCode, signInWithPasskey, signOut } = await import('./signIn.ts')

const requestMock = vi.mocked(request)
const credentials = { get: vi.fn(), create: vi.fn() }
const parseRequestOptionsFromJSON = vi.fn((options: unknown) => ({ parsed: options }))
const parseCreationOptionsFromJSON = vi.fn((options: unknown) => ({ parsed: options }))
const signed = { toJSON: () => ({ id: 'credential-1' }) }

const SIGN_IN: PasskeyOptions = { challengeId: 'challenge-1', options: { challenge: 'abc' } }
const CREATE: PasskeyOptions = { challengeId: 'challenge-2', options: { challenge: 'def', user: {} } }

function cancelled() {
  return new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError')
}

beforeEach(() => {
  mode.realApi = true
  requestMock.mockReset()
  credentials.get.mockReset()
  credentials.create.mockReset()
  parseRequestOptionsFromJSON.mockClear()
  parseCreationOptionsFromJSON.mockClear()
  vi.stubGlobal('navigator', { credentials })
  vi.stubGlobal('PublicKeyCredential', { parseRequestOptionsFromJSON, parseCreationOptionsFromJSON })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('signInWithPasskey', () => {
  it('signs the challenge with the browser’s own functions and sends it back', async () => {
    requestMock.mockResolvedValueOnce(SIGN_IN).mockResolvedValueOnce(undefined)
    credentials.get.mockResolvedValue(signed)

    await expect(signInWithPasskey()).resolves.toBe('signedIn')

    expect(requestMock).toHaveBeenNthCalledWith(1, 'POST', '/sign-in/start')
    expect(parseRequestOptionsFromJSON).toHaveBeenCalledWith(SIGN_IN.options)
    expect(credentials.get).toHaveBeenCalledWith({ publicKey: { parsed: SIGN_IN.options } })
    expect(requestMock).toHaveBeenNthCalledWith(2, 'POST', '/sign-in/finish', {
      challengeId: 'challenge-1',
      credential: { id: 'credential-1' },
    })
  })

  it('is cancelled when the person closes the passkey sheet, and sends nothing more', async () => {
    requestMock.mockResolvedValueOnce(SIGN_IN)
    credentials.get.mockRejectedValue(cancelled())

    await expect(signInWithPasskey()).resolves.toBe('cancelled')
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  it('is cancelled when the browser gives back no passkey', async () => {
    requestMock.mockResolvedValueOnce(SIGN_IN)
    credentials.get.mockResolvedValue(null)

    await expect(signInWithPasskey()).resolves.toBe('cancelled')
  })

  it('didn’t work when the API refuses the passkey', async () => {
    requestMock.mockResolvedValueOnce(SIGN_IN).mockRejectedValueOnce(new SignedOutError('401'))
    credentials.get.mockResolvedValue(signed)

    await expect(signInWithPasskey()).resolves.toBe('didntWork')
  })

  it('is unsupported without the browser’s JSON functions, and asks the API nothing', async () => {
    vi.stubGlobal('PublicKeyCredential', {})

    await expect(signInWithPasskey()).resolves.toBe('unsupported')
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('throws when a request fails', async () => {
    requestMock.mockRejectedValue(new Error('POST /sign-in/start: 500'))

    await expect(signInWithPasskey()).rejects.toThrow('500')
  })

  it('signs in on mock data without the browser', async () => {
    mode.realApi = false

    await expect(signInWithPasskey()).resolves.toBe('signedIn')
    expect(requestMock).not.toHaveBeenCalled()
    expect(credentials.get).not.toHaveBeenCalled()
  })
})

describe('redeemCode', () => {
  it('spends the code, trimmed, for the options to make a passkey', async () => {
    requestMock.mockResolvedValue(CREATE)

    await expect(redeemCode('  9F3K-ABCD \n')).resolves.toEqual({ outcome: 'redeemed', options: CREATE })
    expect(requestMock).toHaveBeenCalledWith('POST', '/sign-in/code', { code: '9F3K-ABCD' })
  })

  it('didn’t work when the code is wrong, used or old', async () => {
    requestMock.mockRejectedValue(new SignedOutError('401'))

    await expect(redeemCode('nope')).resolves.toEqual({ outcome: 'didntWork' })
  })

  it('is unsupported without the browser’s JSON functions, and keeps the code unspent', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined)

    await expect(redeemCode('9F3K')).resolves.toEqual({ outcome: 'unsupported' })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('redeems on mock data without the API', async () => {
    mode.realApi = false

    await expect(redeemCode('9F3K')).resolves.toMatchObject({ outcome: 'redeemed' })
    expect(requestMock).not.toHaveBeenCalled()
  })
})

describe('addPasskey', () => {
  it('makes a passkey from the redeemed options and keeps it', async () => {
    credentials.create.mockResolvedValue(signed)
    requestMock.mockResolvedValue(undefined)

    await expect(addPasskey(CREATE)).resolves.toBe('signedIn')

    expect(parseCreationOptionsFromJSON).toHaveBeenCalledWith(CREATE.options)
    expect(credentials.create).toHaveBeenCalledWith({ publicKey: { parsed: CREATE.options } })
    expect(requestMock).toHaveBeenCalledWith('POST', '/sign-in/passkeys', {
      challengeId: 'challenge-2',
      credential: { id: 'credential-1' },
    })
  })

  it('is cancelled when the person closes the passkey sheet', async () => {
    credentials.create.mockRejectedValue(cancelled())

    await expect(addPasskey(CREATE)).resolves.toBe('cancelled')
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('didn’t work when the browser can’t make one', async () => {
    credentials.create.mockRejectedValue(new DOMException('Already registered', 'InvalidStateError'))

    await expect(addPasskey(CREATE)).resolves.toBe('didntWork')
  })

  it('didn’t work when the API refuses it', async () => {
    credentials.create.mockResolvedValue(signed)
    requestMock.mockRejectedValue(new SignedOutError('401'))

    await expect(addPasskey(CREATE)).resolves.toBe('didntWork')
  })

  it('signs in on mock data without the browser', async () => {
    mode.realApi = false

    await expect(addPasskey(CREATE)).resolves.toBe('signedIn')
    expect(credentials.create).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('ends the session on the server', async () => {
    requestMock.mockResolvedValue(undefined)

    await signOut()

    expect(requestMock).toHaveBeenCalledWith('POST', '/sign-in/sign-out')
  })

  it('asks nothing of the API on mock data', async () => {
    mode.realApi = false

    await signOut()

    expect(requestMock).not.toHaveBeenCalled()
  })
})
