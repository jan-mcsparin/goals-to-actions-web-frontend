import './TabBar.css'

export type Tab = 'today' | 'week'

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'today', label: 'Today' },
  { tab: 'week', label: 'Week' },
]

type TabBarProps = {
  current: Tab
  onSelect: (tab: Tab) => void
}

export function TabBar({ current, onSelect }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Screens">
      {TABS.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          aria-current={tab === current ? 'page' : undefined}
          onClick={() => onSelect(tab)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
