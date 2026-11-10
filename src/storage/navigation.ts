// Remembers which screen is open, including an opened day, aspiration or goal,
// so the app comes back where it was after a reload or iOS restart (ADR-004).
// Bad or blocked storage falls back to Today.

// Where a goal was opened from, so back returns there.
export type GoalOrigin = { screen: 'aspirations' } | { screen: 'aspiration'; aspirationId: string }

export type Screen =
  | { screen: 'today' }
  | { screen: 'week' }
  | { screen: 'day'; date: string }
  | { screen: 'aspirations' }
  | { screen: 'aspiration'; aspirationId: string }
  | { screen: 'upkeep' }
  | { screen: 'goal'; goalId: string; from: GoalOrigin }

export type Tab = 'today' | 'week' | 'aspirations'

const KEY = 'gta.screen'
const TODAY: Screen = { screen: 'today' }
const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/

export function readScreen(): Screen {
  try {
    return parseScreen(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? TODAY
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

// An opened day counts as Week; an opened aspiration, goal or Keep life
// running counts as Aspirations.
export function tabOf(screen: Screen): Tab {
  if (screen.screen === 'today') return 'today'
  if (screen.screen === 'week' || screen.screen === 'day') return 'week'
  return 'aspirations'
}

function parseScreen(value: unknown): Screen | undefined {
  if (!isRecord(value)) return undefined
  const { screen, date, goalId } = value
  if (screen === 'today' || screen === 'week' || screen === 'upkeep') return { screen }
  if (screen === 'day' && typeof date === 'string' && LOCAL_DAY.test(date)) return { screen, date }
  if (screen === 'goal' && isId(goalId)) {
    const from = parseGoalOrigin(value.from)
    return from && { screen, goalId, from }
  }
  return parseGoalOrigin(value)
}

function parseGoalOrigin(value: unknown): GoalOrigin | undefined {
  if (!isRecord(value)) return undefined
  const { screen, aspirationId } = value
  if (screen === 'aspirations') return { screen }
  if (screen === 'aspiration' && isId(aspirationId)) return { screen, aspirationId }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
