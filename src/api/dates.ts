// Local-calendar helpers. Never use toISOString() for a day: it's UTC and
// gives the wrong date in the evening west of Greenwich.

export function toLocalDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

// Weeks start Monday.
export function mondayOf(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7
  return addDays(date, -daysSinceMonday)
}

// The Monday of a 'YYYY-MM-DD' day, as a day.
export function mondayOfDay(day: string): string {
  return toLocalDay(mondayOf(fromLocalDay(day)))
}

// Reads 'YYYY-MM-DD' as local midnight. new Date('YYYY-MM-DD') would be UTC.
export function fromLocalDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}
