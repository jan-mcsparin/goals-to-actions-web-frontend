// Remembers Today's List / By goal choice across reloads and iOS restarts
// (ADR-004). localStorage can be missing or blocked, so every access is
// guarded and falls back to the list view.
export type TodayViewMode = 'list' | 'byGoal'

const KEY = 'gta.todayView'

export function readTodayView(): TodayViewMode {
  try {
    return localStorage.getItem(KEY) === 'byGoal' ? 'byGoal' : 'list'
  } catch {
    return 'list'
  }
}

export function saveTodayView(view: TodayViewMode): void {
  try {
    localStorage.setItem(KEY, view)
  } catch {
    // Not remembered this time; the screen still switches.
  }
}
