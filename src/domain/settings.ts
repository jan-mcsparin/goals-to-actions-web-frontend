// The intensities, in the order Settings shows them. None ranks above another.
import type { Intensity } from '../api/types.ts'

export const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'easingOff', label: 'Easing off' },
  { value: 'normal', label: 'Normal' },
  { value: 'goingHard', label: 'Going hard' },
]

export function isIntensity(value: string): value is Intensity {
  return INTENSITIES.some((intensity) => intensity.value === value)
}
