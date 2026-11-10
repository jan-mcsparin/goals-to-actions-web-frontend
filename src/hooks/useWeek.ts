// This week, ready to render: progress per goal, a line per day, and the bank.
// Loads through the API client; rules come from domain/week.ts.
import { useEffect, useState } from 'react'
import { getWeek } from '../api/client.ts'
import type { WeekPlan } from '../api/types.ts'
import { daySummaries, weekProgress, weekRange, type DaySummary, type ProgressRow } from '../domain/week.ts'

const LOAD_FAILED = "Couldn't load this week. Try again in a moment."

export type WeekView = {
  range: string
  progress: ProgressRow[]
  days: DaySummary[]
}

export type UseWeek = {
  week?: WeekView
  message?: string
}

export function useWeek(today: string): UseWeek {
  const [plan, setPlan] = useState<WeekPlan>()
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let current = true
    getWeek()
      .then((loaded) => current && setPlan(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [])

  return { week: plan && viewOf(plan, today), message }
}

function viewOf(plan: WeekPlan, today: string): WeekView {
  return {
    range: weekRange(plan.weekOf),
    progress: weekProgress(plan, today),
    days: daySummaries(plan, today),
  }
}
