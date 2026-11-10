// Remembers which screen is open, including an opened day, so the app comes
// back where it was after a reload or iOS restart (ADR-004). Bad or blocked
// storage falls back to Today.
export type Screen = { screen: 'today' } | { screen: 'week' } | { screen: 'day'; date: string }

const KEY = 'gta.screen'
const TODAY: Screen = { screen: 'today' }
const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/

export function readScreen(): Screen {
  try {
    return parseScreen(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return TODAY
  }
}

export function saveScreen(screen: Screen): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(screen))
  } catch {
    // Not remembered this time; navigation still works.
  }
}

function parseScreen(value: unknown): Screen {
  if (typeof value !== 'object' || value === null) return TODAY
  const { screen, date } = value as { screen?: unknown; date?: unknown }
  if (screen === 'week') return { screen: 'week' }
  if (screen === 'day' && typeof date === 'string' && LOCAL_DAY.test(date)) return { screen: 'day', date }
  return TODAY
}
