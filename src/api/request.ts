// The one place that talks to the API. Every request carries the phone's time
// zone (the API works out "today" from it) and JSON both ways, with field names
// as they are: the API already speaks camelCase. A 404 is NotFoundError; a
// 401 is SignedOutError and tells the session, except from the sign-in routes,
// where it means the code or passkey didn't work. Any other failure, a network
// one included, is a plain Error, which screens report as a failed request.
import { NotFoundError, SignedOutError } from './errors.ts'
import { signedOut } from './session.ts'

export type Method = 'GET' | 'PUT' | 'PATCH' | 'POST'

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  if (response.status === 401) {
    if (!path.startsWith('/sign-in/')) signedOut()
    throw new SignedOutError(`${method} ${path}: not signed in`)
  }
  if (response.status === 404) throw new NotFoundError(`${method} ${path}: not found`)
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
  return (await response.json()) as T
}
