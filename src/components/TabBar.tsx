import type { Tab } from '../storage/navigation.ts'
import './TabBar.css'

type TabBarProps = {
  current: Tab
  onSelect: (tab: Tab) => void
  // The + opens the Add sheet over whatever is showing; it's never the current tab.
  onAdd: () => void
}

export function TabBar({ current, onSelect, onAdd }: TabBarProps) {
  const tab = (value: Tab, label: string) => (
    <button type="button" aria-current={value === current ? 'page' : undefined} onClick={() => onSelect(value)}>
      {label}
    </button>
  )

  return (
    <nav className="tab-bar" aria-label="Screens">
      {tab('today', 'Today')}
      {tab('week', 'Week')}
      <button type="button" className="tab-bar-add" aria-label="Add" onClick={onAdd}>
        +
      </button>
      {tab('aspirations', 'Aspirations')}
    </nav>
  )
}
