// One goal in full: where it started, the timeline from Start to the goal
// itself (condensed past four milestones), the weekly target and the next
// check-in. A reached or ended goal shows what it achieved.
import { useEffect, useState } from 'react'
import { AddMilestoneSheet } from '../components/AddMilestoneSheet.tsx'
import { BackLink } from '../components/BackLink.tsx'
import { TargetSheet } from '../components/TargetSheet.tsx'
import { shownRowKey, type CurrentPage, type GoalPage, type ShownRow } from '../domain/goalDetail.ts'
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
type OpenSheet = 'target' | 'milestone'

export function GoalDetail({ goalId, from, today, onBack, onOpenAspiration, onNotFound }: GoalDetailProps) {
  const { page, backTo, timeline, targetDraft, message, notFound, expand, collapse, setTarget, addMilestone } =
    useGoal(goalId, from, today)
  const [sheet, setSheet] = useState<OpenSheet>()

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
          />
          {page.kind === 'current' && <CurrentSections page={page} onEditTarget={() => setSheet('target')} />}
        </>
      )}

      <TargetSheet
        open={sheet === 'target'}
        initial={targetDraft}
        onSave={(draft) => {
          setTarget(draft)
          closeSheet()
        }}
        onClose={closeSheet}
      />
      <AddMilestoneSheet
        open={sheet === 'milestone'}
        noun={page?.timeline.heading === 'Steps' ? 'step' : 'milestone'}
        dateRange={page?.kind === 'current' ? page.dateRange : undefined}
        onSave={(draft) => {
          addMilestone(draft)
          closeSheet()
        }}
        onClose={closeSheet}
      />
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
}

function TimelineSection({ page, timeline, onExpand, onCollapse, onAdd }: TimelineSectionProps) {
  const canAdd = page.kind === 'current'
  return (
    <section className="goal-section" aria-labelledby="goal-timeline">
      <div className="goal-section-head">
        <h2 id="goal-timeline">{page.timeline.heading}</h2>
        <span>{page.timeline.count}</span>
      </div>
      <ol className="timeline">
        {timeline.rows.map((row) => (
          <TimelineItem key={shownRowKey(row)} row={row} onExpand={onExpand} />
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

function TimelineItem({ row, onExpand }: { row: ShownRow; onExpand: () => void }) {
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
  return (
    <li className={classes}>
      <span className="timeline-top">
        <span className="timeline-title">{row.measurableLine}</span>
        {row.next && <span className="timeline-next">Next</span>}
      </span>
      <span className="timeline-detail">{row.kind === 'goal' ? row.detail : row.when}</span>
      {row.statusLine && <span className="timeline-status">{row.statusLine}</span>}
    </li>
  )
}

function CurrentSections({ page, onEditTarget }: { page: CurrentPage; onEditTarget: () => void }) {
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
        <div className="goal-check-in">
          <p className="goal-value">{page.nextCheckIn.measurableLine}</p>
          <p className="goal-note">{page.nextCheckIn.when}</p>
        </div>
      </section>
    </>
  )
}
