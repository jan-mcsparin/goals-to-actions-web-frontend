// Today's plan, ready to render. Loads through the API client and hands the
// screen sections and progress worked out by domain/today.ts.
import { useEffect, useState } from 'react'
import { getToday } from '../api/client.ts'
import type { TodayPlan } from '../api/types.ts'
import { dayHeading, groupForList, progress, type Section } from '../domain/today.ts'

export type TodayView = {
  heading: string
  progress: { done: number; total: number }
  sections: Section[]
}

export type UseToday = {
  today?: TodayView
  message?: string
}

export function useToday(): UseToday {
  const [plan, setPlan] = useState<TodayPlan>()
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let current = true
    getToday()
      .then((loaded) => current && setPlan(loaded))
      .catch(() => current && setMessage("Couldn't load today. Try again in a moment."))
    return () => {
      current = false
    }
  }, [])

  return { today: plan && viewOf(plan), message }
}

function viewOf(plan: TodayPlan): TodayView {
  return { heading: dayHeading(plan.date), progress: progress(plan), sections: groupForList(plan) }
}
