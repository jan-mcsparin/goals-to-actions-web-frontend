// What a quitting goal's daily answer shows (spec 037): the quiet row on a day, the goal page's
// run line and its last days. A day with no answer is unknown, never a slip. The run is the
// server's (ADR-008); queued changes only show on their days.
import { addDays, fromLocalDay, toLocalDay } from '../api/dates.ts'
import type { QuitDay, QuitRecord, UrgeLevel, Week } from '../api/types.ts'
import { isQuitChange, quitDayAfter, type Change } from './replay.ts'

export type QuitAnswer = 'unanswered' | 'held' | 'slipped'

// One quitting goal's day, as a row on Today or an opened day. It isn't a task.
export type QuitRow = {
  goalId: string
  label: string
  day: string
  answer: QuitAnswer
  answerLabel?: string
  urge: UrgeLevel | null
}

export type RecordDay = {
  day: string
  dayLabel: string
  answer: QuitAnswer
  answerLabel: string
  answered: boolean
  urge: UrgeLevel | null
  urgeLabel?: string
}

export const URGE_CHOICES: { level: UrgeLevel; label: string }[] = [
  { level: 'low', label: 'Low' },
  { level: 'some', label: 'Some' },
  { level: 'strong', label: 'Strong' },
]

const ANSWER_LABELS: Record<Exclude<QuitAnswer, 'unanswered'>, string> = { held: 'Held', slipped: 'Slipped' }
const UNANSWERED = '–'

// Each active quitting goal's row for the day, from the week read. A future day, or one
// before the goal started (not in the week's days), offers nothing.
export function quitRows(week: Week, date: string, today: string): QuitRow[] {
  if (date > today) return []
  return week.quittingGoals.flatMap((goal) => {
    const quitDay = goal.days.find((candidate) => candidate.day === date)
    if (!quitDay) return []
    const answer = answerOf(quitDay)
    return [
      {
        goalId: goal.id,
        label: goal.label,
        day: date,
        answer,
        ...(answer !== 'unanswered' && { answerLabel: ANSWER_LABELS[answer] }),
        urge: quitDay.urge,
      },
    ]
  })
}

export function answerOf({ held }: Pick<QuitDay, 'held'>): QuitAnswer {
  if (held === null) return 'unanswered'
  return held ? 'held' : 'slipped'
}

// "12 days held", with "· 2 not answered" while days in the run have no answer.
export function runLine({ heldRun, unknownInRun }: QuitRecord): string {
  const held = heldRun === 0 ? 'No days held yet' : `${heldRun} ${heldRun === 1 ? 'day' : 'days'} held`
  return unknownInRun > 0 ? `${held} · ${unknownInRun} not answered` : held
}

// The record's days as they come, newest first.
export function recordDays(record: QuitRecord, today: string): RecordDay[] {
  return record.days.map((quitDay) => {
    const answer = answerOf(quitDay)
    return {
      day: quitDay.day,
      dayLabel: recordDayLabel(quitDay.day, today),
      answer,
      answerLabel: answer === 'unanswered' ? UNANSWERED : ANSWER_LABELS[answer],
      answered: answer !== 'unanswered',
      urge: quitDay.urge,
      ...(quitDay.urge && { urgeLabel: `${URGE_CHOICES.find((choice) => choice.level === quitDay.urge)!.label} urge` }),
    }
  })
}

function recordDayLabel(day: string, today: string): string {
  if (day === today) return 'Today'
  if (day === toLocalDay(addDays(fromLocalDay(today), -1))) return 'Yesterday'
  return fromLocalDay(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// The goal page's record with this goal's queued answers and ratings on their days. The run
// stays as the server worked it out until the goal is read again.
export function withQueuedQuitDays(record: QuitRecord, goalId: string, changes: Change[]): QuitRecord {
  const mine = changes.filter(isQuitChange).filter((change) => change.goalId === goalId)
  if (mine.length === 0) return record
  return {
    ...record,
    days: record.days.map((quitDay) =>
      mine.filter((change) => change.day === quitDay.day).reduce(quitDayAfter, quitDay),
    ),
  }
}
