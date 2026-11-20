import './ViewToggle.css'

export type ViewOption<View extends string> = { view: View; label: string }

type ViewToggleProps<View extends string> = {
  // What the group is called to a screen reader: "View", "Week".
  label: string
  view: View
  options: ViewOption<View>[]
  onChange: (view: View) => void
}

export function ViewToggle<View extends string>({ label, view, options, onChange }: ViewToggleProps<View>) {
  return (
    <div className="view-toggle" role="group" aria-label={label}>
      {options.map((option) => (
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
