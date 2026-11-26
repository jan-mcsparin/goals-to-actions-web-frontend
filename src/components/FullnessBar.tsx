import { barSegments, type Segment } from '../domain/week.ts'
import type { DayCounts } from '../api/types.ts'
import './fullness.css'

type FullnessBarProps = {
  counts: DayCounts
  // What a full bar stands for: a typical week, or the day's cap.
  against: number
  size: 'week' | 'day'
  label: string
}

// Three segments in order (goal sessions, upkeep, added) on an outlined track. A guide only:
// past `against` it's simply full, never red.
export function FullnessBar({ counts, against, size, label }: FullnessBarProps) {
  return (
    <span className="fullness-bar" data-size={size} role="img" aria-label={label}>
      {barSegments(counts, against).map((segment: Segment) => (
        <span
          key={segment.origin}
          className="fullness-segment"
          data-origin={segment.origin}
          style={{ width: `${segment.share * 100}%` }}
        />
      ))}
    </span>
  )
}
