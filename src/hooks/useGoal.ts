// One goal's page, ready to render, plus the timeline's Show all state and
// the ways to change the goal. Loads through the API client; the layout comes
// from domain/goalDetail.ts. A goal that isn't there is reported as not
// found, so the screen can go back quietly.
import { useCallback, useRef, useState } from 'react'
import {
  addMilestone as saveMilestone,
  checkIn as saveCheckIn,
  endGoal,
  getGoal,
  goAgain,
  keepMilestone,
  markGoalReached,
  pauseGoal,
  reopenGoal,
  resumeGoal,
  setWeeklyTarget,
  updateMilestone,
} from '../api/client.ts'
import type { Goal, GoalDetail } from '../api/types.ts'
import {
  backLabel,
  canCondense,
  condenseTimeline,
  goalPage,
  hitLine,
  parsedMilestone,
  parsedTarget,
  reopenDraft,
  showAllLabel,
  targetDraft,
  withCheckIn,
  withMilestone,
  withReopened,
  withTarget,
  type GoalPage,
  type MilestoneDraft,
  type ReopenChanges,
  type ShownRow,
  type TargetDraft,
} from '../domain/goalDetail.ts'
import { readTimelineExpanded, saveTimelineExpanded } from '../storage/timelinePreference.ts'
import type { GoalOrigin } from './useNavigation.ts'
import { useLoaded } from './useLoaded.ts'

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
  // What the move and adjust sheets start from.
  reopenDraftFor: (milestoneId: string) => MilestoneDraft
  // "Milestone hit: …" after a hit, until the next change.
  justHit?: string
  message?: string
  notFound: boolean
  expand: () => void
  collapse: () => void
  setTarget: (draft: TargetDraft) => void
  addMilestone: (draft: MilestoneDraft) => void
  checkIn: (milestoneId: string | undefined, outcome: 'hit' | 'notYet', result: string) => void
  reopen: (milestoneId: string, changes: ReopenChanges) => void
  // These change the goal's status and its tasks, so they wait for the save.
  pause: () => Promise<void>
  // From paused, from ended (Go again), or from reached (Reopen).
  resume: () => Promise<void>
  end: (outcome: 'reached' | 'ended') => Promise<void>
}

export function useGoal(goalId: string, from: GoalOrigin, today: string): UseGoal {
  const { data: detail, setData: setDetail, message, setMessage, notFound } = useLoaded(
    useCallback(() => getGoal(goalId), [goalId]),
    LOAD_FAILED,
  )
  const [expanded, setExpanded] = useState(() => readTimelineExpanded(goalId))
  const [justHit, setJustHit] = useState<string>()
  const pendingCount = useRef(0)
  const lastSave = useRef(0)
  const waiting = useRef(false)

  function showAll(next: boolean) {
    setExpanded(next)
    saveTimelineExpanded(goalId, next)
  }

  // Shows the change, then saves it, then shows what the save returned. Only
  // the latest save is shown, so a slow first save can't flash over a quick
  // second one. If a save fails, the goal is loaded again from the API and
  // the message shows, whichever save it was.
  function saveOptimistically<T>(
    change: (before: GoalDetail) => GoalDetail,
    save: () => Promise<T>,
    settle: (shown: GoalDetail, saved: T) => GoalDetail,
  ) {
    const thisSave = ++lastSave.current
    setDetail((before) => before && change(before))
    setMessage(undefined)
    save()
      .then((saved) => thisSave === lastSave.current && setDetail((shown) => shown && settle(shown, saved)))
      .catch(() => {
        setJustHit(undefined)
        setMessage(SAVE_FAILED)
        getGoal(goalId)
          .then(setDetail)
          .catch(() => {
            // Keeps what's shown; the message already says to try again.
          })
      })
  }

  // The goal that comes back has the target as saved, so a change waiting
  // for next week (ADR-009) shows its own week.
  function setTarget(draft: TargetDraft) {
    const target = parsedTarget(draft)
    if (!target) return
    saveOptimistically(
      (before) => withTarget(before, target, today),
      () => setWeeklyTarget(goalId, target),
      (shown, goal: Goal) => ({ ...shown, goal }),
    )
  }

  function addMilestone(draft: MilestoneDraft) {
    const milestone = detail && parsedMilestone(draft, detail.goal)
    if (!milestone) return
    const pendingId = `pending-${++pendingCount.current}`
    saveOptimistically(
      (before) => withMilestone(before, pendingId, milestone),
      () => saveMilestone(goalId, milestone),
      showPage,
    )
  }

  // Changes several records at once (status, tasks), so it waits for the
  // save and then loads the goal again. A second tap while it's on its way
  // does nothing.
  async function saveThenReload(save: () => Promise<unknown>) {
    if (waiting.current) return
    waiting.current = true
    ++lastSave.current // a save still on its way shows nothing over this one
    setMessage(undefined)
    setJustHit(undefined)
    try {
      await save()
      setDetail(await getGoal(goalId))
    } catch {
      setMessage(SAVE_FAILED)
    } finally {
      waiting.current = false
    }
  }

  // Without a milestoneId it's the goal's own line: a hit reaches the goal.
  // Either way the check-in is kept, and its result is the latest.
  function checkIn(milestoneId: string | undefined, outcome: 'hit' | 'notYet', result: string) {
    if (!detail) return
    setJustHit(milestoneId && outcome === 'hit' ? hitLine(detail, milestoneId) : undefined)
    saveOptimistically(
      (before) => withCheckIn(before, milestoneId ?? null, outcome, result, today),
      () => saveCheckIn(goalId, milestoneId ?? null, outcome, result),
      showPage,
    )
  }

  // Keep the date sends nothing but the milestone; Move and Adjust send its
  // line and date whole, each as it was unless changed.
  function reopen(milestoneId: string, changes: ReopenChanges) {
    const milestone = detail?.milestones.find((row) => row.id === milestoneId)
    if (!milestone) return
    setJustHit(undefined)
    const edited = changes.measurableLine !== undefined || changes.targetDate !== undefined
    saveOptimistically(
      (before) => withReopened(before, milestoneId, changes),
      () =>
        edited
          ? updateMilestone(milestoneId, {
              measurableLine: changes.measurableLine ?? milestone.measurableLine,
              targetDate: changes.targetDate ?? milestone.targetDate,
            })
          : keepMilestone(milestoneId),
      showPage,
    )
  }

  // Each way back is its own route: resume from paused, reopen from reached,
  // go again from ended.
  function comeBack(): Promise<Goal> {
    if (detail?.goal.status === 'reached') return reopenGoal(goalId)
    if (detail?.goal.status === 'ended') return goAgain(goalId)
    return resumeGoal(goalId)
  }

  const page = detail && goalPage(detail, today)
  return {
    page,
    backTo: backLabel(from, detail?.aspiration),
    timeline: page && shownTimeline(page, expanded),
    targetDraft: detail && targetDraft(detail),
    reopenDraftFor: (milestoneId) => (detail ? reopenDraft(detail, milestoneId) : { measurableLine: '', targetDate: '' }),
    justHit,
    message,
    notFound,
    expand: () => showAll(true),
    collapse: () => showAll(false),
    setTarget,
    addMilestone,
    checkIn,
    reopen,
    pause: () => saveThenReload(() => pauseGoal(goalId)),
    resume: () => saveThenReload(comeBack),
    end: (outcome) => saveThenReload(() => (outcome === 'reached' ? markGoalReached(goalId) : endGoal(goalId))),
  }
}

// A milestone or check-in write returns the whole page.
function showPage(_shown: GoalDetail, page: GoalDetail): GoalDetail {
  return page
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
