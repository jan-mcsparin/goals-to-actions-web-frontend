// The one place that talks to the API. Every request carries the phone's time
// zone (the API works out "today" from it) and JSON both ways, with field names
// as they are: the API already speaks camelCase. A 404 is NotFoundError, a
// 409 RefusedError; a 401 is SignedOutError and tells the session, except from the sign-in routes,
// where it means the code or passkey didn't work. Any other failure, a network
// one included, is a plain Error, which screens report as a failed request.
import { NotFoundError, RefusedError, SignedOutError } from './errors.ts'
import { signedOut, signIns } from './session.ts'

export type Method = 'GET' | 'PUT' | 'PATCH' | 'POST'

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const sentAt = signIns()
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  if (response.status === 401) {
    // The sign-in routes (signIn.ts) answer 401 when a code or passkey didn't
    // work; that isn't the session ending.
    if (!path.startsWith('/sign-in/')) signedOut(sentAt)
    throw new SignedOutError(`${method} ${path}: not signed in`)
  }
  if (response.status === 404) throw new NotFoundError(`${method} ${path}: not found`)
  if (response.status === 409) throw new RefusedError(`${method} ${path}: 409 ${await reasonOf(response)}`)
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// The API's own words for a refusal, when it gave any.
async function reasonOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && 'detail' in body ? String(body.detail) : ''
  } catch {
    return ''
  }
}
