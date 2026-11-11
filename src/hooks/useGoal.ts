// One goal's page, ready to render, plus the timeline's Show all state.
// Loads through the API client; the layout comes from domain/goalDetail.ts.
// A goal that isn't there is reported as not found, so the screen can go
// back quietly.
import { useEffect, useState } from 'react'
import { getGoal, NotFoundError } from '../api/client.ts'
import type { GoalDetail } from '../api/types.ts'
import {
  backLabel,
  canCondense,
  condenseTimeline,
  goalPage,
  showAllLabel,
  type GoalPage,
  type ShownRow,
} from '../domain/goalDetail.ts'
import { readTimelineExpanded, saveTimelineExpanded } from '../storage/timelinePreference.ts'
import type { GoalOrigin } from './useNavigation.ts'

const LOAD_FAILED = "Couldn't load this goal. Try again in a moment."

export type ShownTimeline = {
  rows: ShownRow[]
  condensable: boolean
  expanded: boolean
  showAllLabel: string
}

export type UseGoal = {
  page?: GoalPage
  backTo?: string
  timeline?: ShownTimeline
  message?: string
  notFound: boolean
  expand: () => void
  collapse: () => void
}

export function useGoal(goalId: string, from: GoalOrigin, today: string): UseGoal {
  const [detail, setDetail] = useState<GoalDetail>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const [expanded, setExpanded] = useState(() => readTimelineExpanded(goalId))

  useEffect(() => {
    let current = true
    getGoal(goalId)
      .then((loaded) => current && setDetail(loaded))
      .catch((error: unknown) => {
        if (!current) return
        if (error instanceof NotFoundError) setNotFound(true)
        else setMessage(LOAD_FAILED)
      })
    return () => {
      current = false
    }
  }, [goalId])

  function showAll(next: boolean) {
    setExpanded(next)
    saveTimelineExpanded(goalId, next)
  }

  const page = detail && goalPage(detail, today)
  return {
    page,
    backTo: detail ? backLabel(from, detail.aspiration) : from.screen === 'aspirations' ? 'Aspirations' : undefined,
    timeline: page && shownTimeline(page, expanded),
    message,
    notFound,
    expand: () => showAll(true),
    collapse: () => showAll(false),
  }
}

function shownTimeline({ timeline }: GoalPage, expanded: boolean): ShownTimeline {
  const condensable = canCondense(timeline)
  return {
    rows: expanded ? timeline.rows : condenseTimeline(timeline),
    condensable,
    expanded: condensable && expanded,
    showAllLabel: showAllLabel(timeline),
  }
}
