// The tasks the person said "Not now" to on a day, so Today stops asking until tomorrow.
// localStorage can be missing or blocked, so every access is guarded: the card just comes back.
const KEY = 'gta.stillMattersNotNow'

type Saved = { day: string; ids: string[] }

export function readNotNow(day: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    return saved?.day === day && Array.isArray(saved.ids) ? saved.ids : []
  } catch {
    return []
  }
}

export function saveNotNow(day: string, ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day, ids } satisfies Saved))
  } catch {
    // Not remembered this time; the card still goes.
  }
}
