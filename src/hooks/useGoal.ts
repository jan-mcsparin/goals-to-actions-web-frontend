// One goal's page, ready to render, plus the timeline's Show all state and
// the ways to change the goal. Loads through the API client; the layout comes
// from domain/goalDetail.ts. A goal that isn't there is reported as not
// found, so the screen can go back quietly.
import { useEffect, useRef, useState } from 'react'
import { addMilestone as saveMilestone, getGoal, NotFoundError, setWeeklyTarget } from '../api/client.ts'
import type { GoalDetail } from '../api/types.ts'
import {
  backLabel,
  canCondense,
  condenseTimeline,
  goalPage,
  parsedMilestone,
  parsedTarget,
  showAllLabel,
  targetDraft,
  withMilestone,
  withTarget,
  type GoalPage,
  type MilestoneDraft,
  type ShownRow,
  type TargetDraft,
} from '../domain/goalDetail.ts'
import { readTimelineExpanded, saveTimelineExpanded } from '../storage/timelinePreference.ts'
import type { GoalOrigin } from './useNavigation.ts'

const LOAD_FAILED = "Couldn't load this goal. Try again in a moment."
const SAVE_FAILED = "Couldn't save that. Try again."

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
  // What the target sheet starts from.
  targetDraft?: TargetDraft
  message?: string
  notFound: boolean
  expand: () => void
  collapse: () => void
  setTarget: (draft: TargetDraft) => void
  addMilestone: (draft: MilestoneDraft) => void
}

export function useGoal(goalId: string, from: GoalOrigin, today: string): UseGoal {
  const [detail, setDetail] = useState<GoalDetail>()
  const [message, setMessage] = useState<string>()
  const [notFound, setNotFound] = useState(false)
  const [expanded, setExpanded] = useState(() => readTimelineExpanded(goalId))
  const pendingCount = useRef(0)

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

  // Shows the change, then saves it. If the save fails, the goal is loaded
  // again from the API and the message shows, whichever save it was.
  function saveOptimistically<T>(
    change: (before: GoalDetail) => GoalDetail,
    save: () => Promise<T>,
    settle?: (shown: GoalDetail, saved: T) => GoalDetail,
  ) {
    setDetail((before) => before && change(before))
    setMessage(undefined)
    save()
      .then((saved) => settle && setDetail((shown) => shown && settle(shown, saved)))
      .catch(() => {
        setMessage(SAVE_FAILED)
        getGoal(goalId)
          .then(setDetail)
          .catch(() => {
            // Keeps what's shown; the message already says to try again.
          })
      })
  }

  // What's shown already matches what's saved, so nothing settles afterwards:
  // a slow first save can't flash over a quick second one.
  function setTarget(draft: TargetDraft) {
    const target = parsedTarget(draft)
    if (!target) return
    saveOptimistically(
      (before) => withTarget(before, target, today),
      () => setWeeklyTarget(goalId, target.amount, target.unit),
    )
  }

  function addMilestone(draft: MilestoneDraft) {
    const milestone = detail && parsedMilestone(draft, detail.goal)
    if (!milestone) return
    const pendingId = `pending-${++pendingCount.current}`
    saveOptimistically(
      (before) => withMilestone(before, { id: pendingId, goalId, status: 'upcoming', ...milestone }),
      () => saveMilestone(goalId, milestone),
      (shown, saved) => ({ ...shown, milestones: shown.milestones.map((row) => (row.id === pendingId ? saved : row)) }),
    )
  }

  const page = detail && goalPage(detail, today)
  return {
    page,
    backTo: backLabel(from, detail?.aspiration),
    timeline: page && shownTimeline(page, expanded),
    targetDraft: detail && targetDraft(detail),
    message,
    notFound,
    expand: () => showAll(true),
    collapse: () => showAll(false),
    setTarget,
    addMilestone,
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
