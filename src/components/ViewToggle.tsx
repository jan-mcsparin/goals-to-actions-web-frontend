import type { TodayViewMode } from '../storage/viewPreference.ts'
import './ViewToggle.css'

const OPTIONS: { view: TodayViewMode; label: string }[] = [
  { view: 'list', label: 'List' },
  { view: 'byGoal', label: 'By goal' },
]

type ViewToggleProps = {
  view: TodayViewMode
  onChange: (view: TodayViewMode) => void
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="View">
      {OPTIONS.map((option) => (
        <button
          key={option.view}
          type="button"
          aria-pressed={view === option.view}
          onClick={() => onChange(option.view)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
