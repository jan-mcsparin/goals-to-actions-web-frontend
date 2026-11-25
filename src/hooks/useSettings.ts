// Settings, ready to render, and the one change it allows: intensity. Loads
// through the API client. A new intensity shows at once; if a save fails,
// settings are read again once the saves on their way are done, so the choice
// shown is the one the API has (useSavesOnTheirWay). Export isn't built yet and says so, once settings have loaded, so
// it never takes the place of a load failure.
import { getSettings, setIntensity } from '../api/client.ts'
import type { Intensity } from '../api/types.ts'
import { useLoaded } from './useLoaded.ts'
import { useSavesOnTheirWay } from './useSavesOnTheirWay.ts'

const LOAD_FAILED = "Couldn't load settings. Try again in a moment."
const EXPORT_LATER = 'Coming later.'

export type UseSettings = {
  // Intensity and Export wait for this; the fixed rows don't.
  loaded: boolean
  intensity?: Intensity
  message?: string
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
  chooseIntensity: (intensity: Intensity) => void
  exportData: () => void
}

export function useSettings(): UseSettings {
  const {
    data: settings,
    setData: setSettings,
    message,
    setMessage,
    reload,
  } = useLoaded('settings', getSettings, LOAD_FAILED)
  const track = useSavesOnTheirWay(reload, setMessage)

  function chooseIntensity(intensity: Intensity) {
    if (!settings) return
    setSettings((before) => before && { ...before, intensity })
    track(setIntensity(intensity))
  }

  function exportData() {
    if (!settings) return
    setMessage(EXPORT_LATER)
  }

  return {
    loaded: settings !== undefined,
    intensity: settings?.intensity,
    message,
    clearMessage: () => setMessage(undefined),
    chooseIntensity,
    exportData,
  }
}
