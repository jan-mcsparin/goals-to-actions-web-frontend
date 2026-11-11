// One goal in full: where it started, the timeline from Start to the goal
// itself (condensed past four milestones), the weekly target and the next
// check-in, with the not-yet card while a milestone is not yet. A reached or
// ended goal shows what it achieved. Every sheet opens only from a tap.
import { useEffect, useState } from 'react'
import { AddMilestoneSheet } from '../components/AddMilestoneSheet.tsx'
import { BackLink } from '../components/BackLink.tsx'
import { CheckInSheet } from '../components/CheckInSheet.tsx'
import { ReopenSheet } from '../components/ReopenSheet.tsx'
import { TargetSheet } from '../components/TargetSheet.tsx'
import {
  shownRowKey,
  type CurrentPage,
  type GoalPage,
  type NotYetCard,
  type ShownRow,
} from '../domain/goalDetail.ts'
import { useGoal, type ShownTimeline } from '../hooks/useGoal.ts'
import type { GoalOrigin } from '../hooks/useNavigation.ts'
import './GoalDetail.css'

type GoalDetailProps = {
  goalId: string
  from: GoalOrigin
  today: string
  onBack: () => void
  onOpenAspiration: (aspirationId: string) => void
  onNotFound: () => void
}

// One sheet at a time, and only from a tap.
type OpenSheet = 'target' | 'milestone' | 'checkIn' | 'move' | 'adjust'

// What a check-in is for: a milestone, or the goal itself (no milestoneId).
type CheckInTarget = { milestoneId?: string; measurableLine: string }

export function GoalDetail({ goalId, from, today, onBack, onOpenAspiration, onNotFound }: GoalDetailProps) {
  const goal = useGoal(goalId, from, today)
  const { page, backTo, timeline, message, notFound, expand, collapse } = goal
  const [sheet, setSheet] = useState<OpenSheet>()
  const [checkingIn, setCheckingIn] = useState<CheckInTarget>()
  const steps = page?.timeline.heading === 'Steps'
  const notYet = page?.kind === 'current' ? page.notYet : undefined

  function openCheckIn(target: CheckInTarget) {
    setCheckingIn(target)
    setSheet('checkIn')
  }

  useEffect(() => {
    if (notFound) onNotFound()
  }, [notFound, onNotFound])

  function closeSheet() {
    setSheet(undefined)
  }

  return (
    <main className="goal" aria-busy={!page && !message}>
      <header className="screen-top">
        <div className="goal-top-row">
          <BackLink to={backTo} onBack={onBack} />
          {page && <span className="goal-kind">{page.header.kindLine}</span>}
        </div>
        {page && (
          <>
            <h1 className="screen-title">{page.header.label}</h1>
            <p className="goal-line">{page.header.measurableLine}</p>
            {page.header.aspiration && (
              <button
                type="button"
                className="goal-aspiration"
                onClick={() => onOpenAspiration(page.header.aspiration!.aspirationId)}
              >
                {`${page.header.aspiration.name} ›`}
              </button>
            )}
          </>
        )}
      </header>

      {message && (
        <p className="goal-note" role="status">
          {message}
        </p>
      )}

      {page && timeline && (
        <>
          <Outcome page={page} />
          {page.started && (
            <div className="goal-started">
              <p>{page.started.startedAt}</p>
              {page.started.latest && <p>{page.started.latest}</p>}
            </div>
          )}
          <TimelineSection
            page={page}
            timeline={timeline}
            onExpand={expand}
            onCollapse={collapse}
            onAdd={() => setSheet('milestone')}
            onCheckIn={openCheckIn}
          />
          {page.kind === 'current' && (
            <CurrentSections
              page={page}
              justHit={goal.justHit}
              onEditTarget={() => setSheet('target')}
              onCheckIn={() => openCheckIn(page.nextCheckIn)}
              onKeepDate={(milestoneId) => goal.reopen(milestoneId, {})}
              onMoveDate={() => setSheet('move')}
              onAdjust={() => setSheet('adjust')}
            />
          )}
        </>
      )}

      <TargetSheet
        open={sheet === 'target'}
        initial={goal.targetDraft}
        onSave={(draft) => {
          goal.setTarget(draft)
          closeSheet()
        }}
        onClose={closeSheet}
      />
      <AddMilestoneSheet
        open={sheet === 'milestone'}
        noun={steps ? 'step' : 'milestone'}
        dateRange={page?.kind === 'current' ? page.dateRange : undefined}
        onSave={(draft) => {
          goal.addMilestone(draft)
          closeSheet()
        }}
        onClose={closeSheet}
      />
      <CheckInSheet
        open={sheet === 'checkIn'}
        title={checkingIn?.measurableLine}
        doneLabel={steps && checkingIn?.milestoneId ? 'Done' : 'Hit it'}
        onCheckIn={(outcome, result) => {
          goal.checkIn(checkingIn?.milestoneId, outcome, result)
          closeSheet()
        }}
        onClose={closeSheet}
      />
      {notYet && (
        <ReopenSheet
          open={sheet === 'move' || sheet === 'adjust'}
          mode={sheet === 'adjust' ? 'adjust' : 'move'}
          noun={steps ? 'step' : 'milestone'}
          initial={goal.reopenDraftFor(notYet.milestoneId)}
          dateRange={page?.kind === 'current' ? page.dateRange : undefined}
          onSave={(changes) => {
            goal.reopen(notYet.milestoneId, changes)
            closeSheet()
          }}
          onClose={closeSheet}
        />
      )}
    </main>
  )
}

function Outcome({ page }: { page: GoalPage }) {
  if (page.kind === 'reached') {
    return (
      <div className="goal-outcome">
        <p className="goal-outcome-line">{page.reachedLine}</p>
        {page.whatsNext && <p className="goal-note">{page.whatsNext}</p>}
      </div>
    )
  }
  if (page.kind === 'ended') {
    return (
      <div className="goal-outcome">
        <p className="goal-outcome-line">Not yet.</p>
        <p className="goal-note">{page.achievement}</p>
      </div>
    )
  }
  return null
}

type TimelineSectionProps = {
  page: GoalPage
  timeline: ShownTimeline
  onExpand: () => void
  onCollapse: () => void
  onAdd: () => void
  onCheckIn: (target: CheckInTarget) => void
}

function TimelineSection({ page, timeline, onExpand, onCollapse, onAdd, onCheckIn }: TimelineSectionProps) {
  const canAdd = page.kind === 'current'
  return (
    <section className="goal-section" aria-labelledby="goal-timeline">
      <div className="goal-section-head">
        <h2 id="goal-timeline">{page.timeline.heading}</h2>
        <span>{page.timeline.count}</span>
      </div>
      <ol className="timeline">
        {timeline.rows.map((row) => (
          <TimelineItem key={shownRowKey(row)} row={row} onExpand={onExpand} onCheckIn={onCheckIn} />
        ))}
      </ol>
      {(canAdd || timeline.condensable) && (
        <div className="goal-timeline-foot">
          {canAdd && (
            <button type="button" className="goal-action" onClick={onAdd}>
              {page.timeline.heading === 'Steps' ? '+ Add step' : '+ Add milestone'}
            </button>
          )}
          {timeline.condensable && (
            <button type="button" className="goal-action" onClick={timeline.expanded ? onCollapse : onExpand}>
              {timeline.expanded ? 'Show less' : timeline.showAllLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

type TimelineItemProps = {
  row: ShownRow
  onExpand: () => void
  onCheckIn: (target: CheckInTarget) => void
}

function TimelineItem({ row, onExpand, onCheckIn }: TimelineItemProps) {
  if (row.kind === 'fold') {
    return (
      <li className="timeline-row is-fold">
        <button type="button" className="timeline-fold" onClick={onExpand}>
          {row.label}
        </button>
      </li>
    )
  }
  if (row.kind === 'start') {
    return (
      <li className="timeline-row is-start">
        <span className="timeline-top">
          <span className="timeline-title">Start</span>
          <span className="timeline-when">{row.when}</span>
        </span>
        {row.baseline && <span className="timeline-detail">{row.baseline}</span>}
      </li>
    )
  }

  const classes = ['timeline-row', `is-${row.kind}`, `is-${row.status}`, row.next && 'is-next'].filter(Boolean).join(' ')
  const content = (
    <>
      <span className="timeline-top">
        <span className="timeline-title">{row.measurableLine}</span>
        {row.next && <span className="timeline-next">Next</span>}
      </span>
      <span className="timeline-detail">{row.kind === 'goal' ? row.detail : row.when}</span>
      {row.statusLine && <span className="timeline-status">{row.statusLine}</span>}
    </>
  )
  if (!row.checkable) return <li className={classes}>{content}</li>

  // A row that can be checked in opens the check-in sheet: Next, or any step
  // not done on a one-off goal.
  const target = { measurableLine: row.measurableLine, ...(row.kind === 'milestone' && { milestoneId: row.milestoneId }) }
  return (
    <li className={classes}>
      <button type="button" className="timeline-check-in" onClick={() => onCheckIn(target)}>
        {content}
      </button>
    </li>
  )
}

type CurrentSectionsProps = {
  page: CurrentPage
  justHit?: string
  onEditTarget: () => void
  onCheckIn: () => void
  onKeepDate: (milestoneId: string) => void
  onMoveDate: () => void
  onAdjust: () => void
}

function CurrentSections({ page, justHit, onEditTarget, onCheckIn, onKeepDate, onMoveDate, onAdjust }: CurrentSectionsProps) {
  return (
    <>
      {page.target?.kind === 'weekly' && (
        <section className="goal-section" aria-labelledby="goal-target">
          <h2 id="goal-target">Weekly target</h2>
          <div className="goal-target">
            <p className="goal-value">{page.target.line}</p>
            <button
              type="button"
              className="goal-action"
              aria-label={`${page.target.action} weekly target`}
              onClick={onEditTarget}
            >
              {page.target.action}
            </button>
          </div>
        </section>
      )}
      {page.target?.kind === 'note' && <p className="goal-value">{page.target.line}</p>}

      <section className="goal-section" aria-labelledby="goal-check-in">
        <h2 id="goal-check-in">Next check-in</h2>
        {justHit && (
          <p className="goal-hit" role="status">
            {justHit}
          </p>
        )}
        <div className="goal-check-in">
          <div>
            <p className="goal-value">{page.nextCheckIn.measurableLine}</p>
            <p className="goal-note">{page.nextCheckIn.when}</p>
          </div>
          <button type="button" className="goal-check-in-button" onClick={onCheckIn}>
            Check in
          </button>
        </div>
      </section>

      {page.notYet && (
        <NotYetSection
          card={page.notYet}
          steps={page.timeline.heading === 'Steps'}
          onKeepDate={onKeepDate}
          onMoveDate={onMoveDate}
          onAdjust={onAdjust}
        />
      )}
    </>
  )
}

type NotYetSectionProps = {
  card: NotYetCard
  steps: boolean
  onKeepDate: (milestoneId: string) => void
  onMoveDate: () => void
  onAdjust: () => void
}

// Leads with progress since the baseline, then three ways forward. It stays
// until one is picked, and shows nowhere but here.
function NotYetSection({ card, steps, onKeepDate, onMoveDate, onAdjust }: NotYetSectionProps) {
  return (
    <section className="goal-not-yet" aria-labelledby="goal-not-yet">
      <h2 id="goal-not-yet">Not yet</h2>
      <p className="goal-value">{card.measurableLine}</p>
      {card.progress && <p className="goal-not-yet-progress">{card.progress}</p>}
      <div className="goal-not-yet-choices">
        <button type="button" className="goal-action" onClick={() => onKeepDate(card.milestoneId)}>
          Keep the date
        </button>
        <button type="button" className="goal-action" onClick={onMoveDate}>
          Move the date
        </button>
        <button type="button" className="goal-action" onClick={onAdjust}>
          {steps ? 'Adjust the step' : 'Adjust the milestone'}
        </button>
      </div>
    </section>
  )
}
