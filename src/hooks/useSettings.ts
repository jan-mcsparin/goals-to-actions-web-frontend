// Settings, ready to render, and the one change it allows: intensity. Loads
// through the API client. A new intensity shows at once and goes back if the
// save fails; only the newest save may go back, so quick changes settle on the
// last. Export isn't built yet and says so, once settings have loaded, so
// it never takes the place of a load failure.
import { useRef } from 'react'
import { getSettings, setIntensity } from '../api/client.ts'
import type { Intensity } from '../api/types.ts'
import { useLoaded } from './useLoaded.ts'

const LOAD_FAILED = "Couldn't load settings. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."
const EXPORT_LATER = 'Coming later.'

export type UseSettings = {
  // Intensity and Export wait for this; the fixed rows don't.
  loaded: boolean
  intensity?: Intensity
  message?: string
  chooseIntensity: (intensity: Intensity) => void
  exportData: () => void
}

export function useSettings(): UseSettings {
  const { data: settings, setData: setSettings, message, setMessage } = useLoaded(getSettings, LOAD_FAILED)
  const latestSave = useRef(0)

  function chooseIntensity(intensity: Intensity) {
    if (!settings) return
    const before = settings
    const request = ++latestSave.current
    setSettings({ ...before, intensity })
    setMessage(undefined)
    setIntensity(intensity).catch(() => {
      if (request !== latestSave.current) return
      setSettings(before)
      setMessage(SAVE_FAILED)
    })
  }

  // Cleared first and set a moment later, so a second tap after the line has
  // gone counts as a new message and shows again.
  function exportData() {
    if (!settings) return
    setMessage(undefined)
    queueMicrotask(() => setMessage(EXPORT_LATER))
  }

  return { loaded: settings !== undefined, intensity: settings?.intensity, message, chooseIntensity, exportData }
}
