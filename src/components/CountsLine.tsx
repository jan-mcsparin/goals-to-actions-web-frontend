import type { WeekCounts } from '../api/types.ts'
import { countsLine } from '../domain/week.ts'
import './fullness.css'

// "● 8 for 3 goals · ● 5 upkeep · ● 2 added": each dot its segment's colour, the words dark.
export function CountsLine({ counts }: { counts: WeekCounts }) {
  return (
    <p className="counts-line">
      {countsLine(counts).map((part, index) => (
        <span key={part.origin} className="counts-part">
          {index > 0 && <span aria-hidden="true"> · </span>}
          <span className="counts-dot" data-origin={part.origin} aria-hidden="true" />
          <span>{part.text}</span>
        </span>
      ))}
    </p>
  )
}
