// The one place that talks to the API. Every request carries the phone's time
// zone (the API works out "today" from it) and JSON both ways, with field names
// as they are: the API already speaks camelCase. A 404 is NotFoundError; any
// other failure, a network one included, is a plain Error, which screens
// report as a failed request.
import { NotFoundError } from './errors.ts'

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
  if (response.status === 404) throw new NotFoundError(`${method} ${path}: not found`)
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
  return (await response.json()) as T
}
