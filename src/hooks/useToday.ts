// Today's plan, ready to render, plus the actions the screen offers. Changes
// show immediately and are saved in the background; if a save fails the task
// goes back to how it was (ADR-004). Rules come from domain/today.ts.
import { useEffect, useRef, useState } from 'react'
import { checkOffTask, getToday, uncheckTask } from '../api/client.ts'
import type { Task, TodayPlan } from '../api/types.ts'
import { dayHeading, groupByGoal, groupForList, progress, type Section } from '../domain/today.ts'
import { readTodayView, saveTodayView, type TodayViewMode } from '../storage/viewPreference.ts'

const LOAD_FAILED = "Couldn't load today. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

export type TodayView = {
  heading: string
  progress: { done: number; total: number }
  sections: Section[]
}

export type UseToday = {
  today?: TodayView
  message?: string
  view: TodayViewMode
  setView: (view: TodayViewMode) => void
  toggleDone: (taskId: string) => void
}

export function useToday(): UseToday {
  const [plan, setPlan] = useState<TodayPlan>()
  const [message, setMessage] = useState<string>()
  const [view, setViewState] = useState(readTodayView)
  const latestRequest = useRef(new Map<string, number>())

  useEffect(() => {
    let current = true
    getToday()
      .then((loaded) => current && setPlan(loaded))
      .catch(() => current && setMessage(LOAD_FAILED))
    return () => {
      current = false
    }
  }, [])

  function replaceTask(next: Task) {
    setPlan((previous) =>
      previous && { ...previous, tasks: previous.tasks.map((task) => (task.id === next.id ? next : task)) },
    )
  }

  // Each tap gets a number; only the newest tap on a task may update it, so
  // quick double taps settle on the last one.
  function startRequest(taskId: string) {
    const request = (latestRequest.current.get(taskId) ?? 0) + 1
    latestRequest.current.set(taskId, request)
    return () => latestRequest.current.get(taskId) === request
  }

  function setView(next: TodayViewMode) {
    setViewState(next)
    saveTodayView(next)
  }

  function toggleDone(taskId: string) {
    const before = plan?.tasks.find((task) => task.id === taskId)
    if (!before) return

    const undoing = before.status === 'done'
    replaceTask(undoing ? asPlanned(before) : asDone(before))
    setMessage(undefined)
    const isLatest = startRequest(taskId)

    const save = undoing ? uncheckTask(taskId) : checkOffTask(taskId)
    save
      .then((saved) => isLatest() && replaceTask(saved))
      .catch(() => {
        if (!isLatest()) return
        replaceTask(before)
        setMessage(SAVE_FAILED)
      })
  }

  return { today: plan && viewOf(plan, view), message, view, setView, toggleDone }
}

function viewOf(plan: TodayPlan, view: TodayViewMode): TodayView {
  const sections = view === 'byGoal' ? groupByGoal(plan) : groupForList(plan)
  return { heading: dayHeading(plan.date), progress: progress(plan), sections }
}

function asDone(task: Task): Task {
  return { ...task, status: 'done', completedAt: new Date().toISOString() }
}

function asPlanned({ completedAt: _completedAt, valueLogged: _valueLogged, ...task }: Task): Task {
  return { ...task, status: 'planned' }
}
