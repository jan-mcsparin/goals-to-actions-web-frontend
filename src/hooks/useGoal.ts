// One goal's page, ready to render, plus the timeline's Show all state and
// the ways to change the goal. Loads through the API client; the layout comes
// from domain/goalDetail.ts. A goal that isn't there is reported as not
// found, so the screen can go back quietly.
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  addMilestone as saveMilestone,
  checkIn as saveCheckIn,
  deleteMilestone,
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
import { newDeviceId } from '../api/ids.ts'
import { enqueue, onEmptied } from '../api/queue.ts'
import type { Goal, GoalDetail, UrgeLevel } from '../api/types.ts'
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
import { withQueuedQuitDays } from '../domain/quitting.ts'
import { readTimelineExpanded, saveTimelineExpanded } from '../storage/timelinePreference.ts'
import type { GoalOrigin } from './useNavigation.ts'
import { useDelete, type UseDelete } from './useDelete.ts'
import { useLoaded } from './useLoaded.ts'
import { useQueue } from './useQueue.ts'
import { SAVE_FAILED, useSavesOnTheirWay } from './useSavesOnTheirWay.ts'

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
  // What the target sheet starts from.
  targetDraft?: TargetDraft
  // What the move and adjust sheets start from.
  reopenDraftFor: (milestoneId: string) => MilestoneDraft
  // "Milestone hit: …" after a hit, until the next change.
  justHit?: string
  message?: string
  // Lets the message go once it has gone from the screen, so the same text set
  // again shows again.
  clearMessage: () => void
  notFound: boolean
  expand: () => void
  collapse: () => void
  setTarget: (draft: TargetDraft) => void
  addMilestone: (draft: MilestoneDraft) => void
  checkIn: (milestoneId: string | undefined, outcome: 'hit' | 'notYet', result: string) => void
  reopen: (milestoneId: string, changes: ReopenChanges) => void
  // A milestone made by mistake, by id: asked once, then sent; the goal is read again once it's gone.
  deletingMilestone: UseDelete<string>
  // These change the goal's status and its tasks, so they wait for the save.
  pause: () => Promise<void>
  // From paused, from ended (Go again), or from reached (Reopen).
  resume: () => Promise<void>
  end: (outcome: 'reached' | 'ended') => Promise<void>
  // A quitting goal's day, through the queue (ADR-010): shown on its day at once; the run
  // is the server's, read again once the queue has sent them.
  answerQuitDay: (day: string, held: boolean) => void
  // Back to unknown: the answer and its urge rating.
  clearQuitDay: (day: string) => void
  // null clears the rating.
  rateUrge: (day: string, level: UrgeLevel | null) => void
}

export function useGoal(goalId: string, from: GoalOrigin, today: string): UseGoal {
  const { data: loaded, setData: setDetail, message, setMessage, notFound, reload } = useLoaded(
    `goal/${goalId}`,
    useCallback(() => getGoal(goalId), [goalId]),
    LOAD_FAILED,
  )
  const [expanded, setExpanded] = useState(() => readTimelineExpanded(goalId))
  const [justHit, setJustHit] = useState<string>()
  const track = useSavesOnTheirWay(reload, setMessage)
  const deletingMilestone = useDelete<string>({ send: deleteMilestone, done: reload, failed: setMessage })
  const pendingCount = useRef(0)
  const lastSave = useRef(0)
  const waiting = useRef(false)
  const queue = useQueue()
  const detail = loaded?.quitRecord
    ? { ...loaded, quitRecord: withQueuedQuitDays(loaded.quitRecord, goalId, queue.changes) }
    : loaded

  // A quitting goal's run is worked out by the server: read again once answers are sent.
  const isQuitting = loaded?.goal.type === 'quitting'
  const readAgain = useEffectEvent(() => void reload())
  useEffect(() => (isQuitting ? onEmptied(readAgain) : undefined), [isQuitting])

  function answerQuitDay(day: string, held: boolean) {
    setMessage(undefined)
    void enqueue({ kind: 'answerQuitDay', id: newDeviceId(), goalId, day, held })
  }

  function clearQuitDay(day: string) {
    const urge = detail?.quitRecord?.days.find((candidate) => candidate.day === day)?.urge
    setMessage(undefined)
    void enqueue({ kind: 'clearQuitDay', id: newDeviceId(), goalId, day })
    if (urge) void enqueue({ kind: 'clearUrgeRating', id: newDeviceId(), goalId, day })
  }

  function rateUrge(day: string, level: UrgeLevel | null) {
    setMessage(undefined)
    void enqueue(
      level === null
        ? { kind: 'clearUrgeRating', id: newDeviceId(), goalId, day }
        : { kind: 'rateUrge', id: newDeviceId(), goalId, day, level },
    )
  }

  function showAll(next: boolean) {
    setExpanded(next)
    saveTimelineExpanded(goalId, next)
  }

  // Shows the change, then saves it, then shows what the save returned. Only
  // the latest save is shown, so a slow first save can't flash over a quick
  // second one. If a save fails, the message shows, whichever save it was, and
  // the goal is read again once no saves are on their way (useSavesOnTheirWay).
  function saveOptimistically<T>(
    change: (before: GoalDetail) => GoalDetail,
    save: () => Promise<T>,
    settle: (shown: GoalDetail, saved: T) => GoalDetail,
  ) {
    const thisSave = ++lastSave.current
    setDetail((before) => before && change(before))
    const saving = save()
    track(saving)
    saving.then(
      (saved) => thisSave === lastSave.current && setDetail((shown) => shown && settle(shown, saved)),
      () => setJustHit(undefined),
    )
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
    clearMessage: () => setMessage(undefined),
    notFound,
    expand: () => showAll(true),
    collapse: () => showAll(false),
    setTarget,
    addMilestone,
    checkIn,
    reopen,
    deletingMilestone,
    pause: () => saveThenReload(() => pauseGoal(goalId)),
    resume: () => saveThenReload(comeBack),
    end: (outcome) => saveThenReload(() => (outcome === 'reached' ? markGoalReached(goalId) : endGoal(goalId))),
    answerQuitDay,
    clearQuitDay,
    rateUrge,
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
