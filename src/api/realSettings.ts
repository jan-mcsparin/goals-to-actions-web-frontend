// The settings functions of api/client.ts, on the real API. Same signatures as
// the mock ones.
import { request } from './request.ts'
import type { Intensity, Settings } from './types.ts'

export async function getSettings(): Promise<Settings> {
  return request('GET', '/settings')
}

// Today's intensity for this account; the planner reads it when it fills a week.
export async function setIntensity(intensity: Intensity): Promise<Settings> {
  return request('PUT', '/settings/intensity', { intensity })
}
