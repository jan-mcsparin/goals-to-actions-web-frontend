// This week, ready to render: progress per goal, a line per day, and the bank.
// Loads through the API client; rules come from domain/week.ts.
import { useEffect, useState } from 'react'
import { getWeek, pullFromBank } from '../api/client.ts'
import type { Task, WeekPlan } from '../api/types.ts'
import {
  daySummaries,
  pickableDays,
  weekProgress,
  weekRange,
  type DaySummary,
  type PickableDay,
  type ProgressRow,
} from '../domain/week.ts'
import { withTaskReplaced } from './planUpdates.ts'

const LOAD_FAILED = "Couldn't load this week. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

export type WeekView = {
  range: string
  progress: ProgressRow[]
  days: DaySummary[]
  bank: Task[]
  pickableDays: PickableDay[]
}

export type UseWeek = {
  week?: WeekView
  message?: string
  place: (bankTaskId: string, date: string) => void
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

  // Shows the task on its new day at once; puts it back in the bank if the save fails.
  function place(bankTaskId: string, date: string) {
    const before = plan?.tasks.find((task) => task.id === bankTaskId)
    if (!before) return

    replaceTask({ ...before, status: 'planned', plannedDay: date, placedByHand: true })
    setMessage(undefined)

    pullFromBank(bankTaskId, date)
      .then(replaceTask)
      .catch(() => {
        replaceTask(before)
        setMessage(SAVE_FAILED)
      })
  }

  function replaceTask(next: Task) {
    setPlan((previous) => previous && withTaskReplaced(previous, next.id, next))
  }

  return { week: plan && viewOf(plan, today), message, place }
}

function viewOf(plan: WeekPlan, today: string): WeekView {
  return {
    range: weekRange(plan.weekOf),
    progress: weekProgress(plan, today),
    days: daySummaries(plan, today),
    bank: plan.tasks.filter((task) => task.status === 'inBank'),
    pickableDays: pickableDays(plan.weekOf, today),
  }
}
