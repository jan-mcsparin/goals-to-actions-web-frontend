// Remembers, per goal, whether its timeline is shown in full (Show all) or
// condensed, across reloads and iOS restarts (ADR-004). One key holds the
// expanded goals' ids. Missing, blocked or bad storage means condensed.
const KEY = 'gta.timelineExpanded'

export function readTimelineExpanded(goalId: string): boolean {
  return expandedGoals().includes(goalId)
}

export function saveTimelineExpanded(goalId: string, expanded: boolean): void {
  const others = expandedGoals().filter((id) => id !== goalId)
  try {
    localStorage.setItem(KEY, JSON.stringify(expanded ? [...others, goalId] : others))
  } catch {
    // Not remembered this time; the timeline still switches.
  }
}

function expandedGoals(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : []
  } catch {
    return []
  }
}
