// Remembers whether Week shows This week or Next week across reloads and iOS
// restarts (ADR-004). localStorage can be missing or blocked, so every access is
// guarded and falls back to this week.
export type WeekViewMode = 'this' | 'next'

const KEY = 'gta.weekView'

export function readWeekView(): WeekViewMode {
  try {
    return localStorage.getItem(KEY) === 'next' ? 'next' : 'this'
  } catch {
    return 'this'
  }
}

export function saveWeekView(view: WeekViewMode): void {
  try {
    localStorage.setItem(KEY, view)
  } catch {
    // Not remembered this time; the screen still switches.
  }
}
