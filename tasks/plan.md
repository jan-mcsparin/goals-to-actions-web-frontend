# Implementation Plan: Goal detail (#5)

Spec: [`../specs/005-goal-detail.md`](../specs/005-goal-detail.md). Tasks: [`todo.md`](todo.md). (The plan for #13 is in git history at `255c054`; #4's at `f87a231`.)

## Overview

Replace #4's placeholder with the goal's page: header with type and the aspiration link, Started at / Latest, the milestone timeline (condensed past four, remembered per goal), the weekly target, and the next check-in. Then the actions, only when tapped: edit the target, add a milestone, check in (hit or not yet, with the not-yet card), Pause / Resume, End (reached or ended) and Go again. Everything runs against the mock, and the tab, the aspiration page, Week and Today follow.

Two PRs, two branches:

- **PR 1, `goal-detail-view`:** `getGoal`, the screen shown, the condensed timeline, the target sheet, Add milestone.
- **PR 2, `goal-detail-actions`:** check-in and the not-yet card, Pause / Resume, End / Go again.

## Settled with Jan, 2026-11-10

Spec 005's open questions:

1. **Progress is two text lines** ("Started at", "Latest"). Nothing calculated.
2. **A new target takes effect this week.**
3. **End asks "reached or not."**
4. **Two PRs** (above).
5. **Resuming a goal whose aspiration is retired is allowed.** It keeps its `aspirationId` and shows under Other goals on the tab until the aspiration is brought back.
6. **No Review.** Same reasoning as #13: its choices already sit on the page and nothing shows the last-reviewed date. Actions read **Pause · End goal**. `reviewGoal` and the Review sheet leave scope.

New, from the design review:

7. **A "not yet" milestone stays Next.** Next is the first milestone that isn't hit (upcoming or not yet), so a check-in never skips past one. The design's separate "latest not yet" and "next" rows become one row for building and quitting goals. Next check-in points at it until it's hit.
8. **Moving a milestone's date pushes the later ones out.** When Move the date or Adjust the milestone moves a date later, every later dated milestone of the same goal moves by the same number of days. None goes past the goal's deadline: those that would are set to the deadline. Undated ones stay undated. Moving a date earlier pulls nothing in. The date picker itself stops at the deadline (`max`).
9. **A one-off goal's steps can be checked in in any order.** Every step that isn't done opens the check-in sheet from its row. Next check-in still shows the first one that isn't done. Steps never push each other out.

## Dependency graph

```
getGoal + GoalDetail ──► domain/goalDetail.ts ──► condenseTimeline + storage pref
        │                         │                          │
        ▼                         ▼                          ▼
setWeeklyTarget, addMilestone   useGoal ──────────────► GoalDetail screen (shown) ──► target sheet, Add milestone
                                  │                                                      │
                                  │                                           ── PR 1 ───┘
                                  ▼
checkIn / reopen (push-out) ──► check-in sheet + not-yet card
pause / resume / end ─────────► Other goals for a retired aspiration ──► Pause, End sheet, Go again
                                                                               │
                                                                        Docs ── PR 2
```

API tasks share `client.ts` and run in order. Screen tasks share `GoalDetail.tsx` and run in order. Within PR 2, the API work (7, 8) and the domain change in 8 can be done before either screen task.

## Architecture decisions

- **`GoalDetail` is records**: `{ goal, aspiration?, milestones, weeklyTarget? }`, like `AspirationDetail`. `weeklyTarget` is the row in force this week whatever the goal's status (`currentTarget`, not `targetsInForce`, which only covers active goals), so a paused goal still shows its target.
- **`reopenMilestone` returns the goal's milestones** (`Milestone[]`), not one milestone, because a date change can move several. This changes the spec's signature; the spec is updated in Task 0.
- **Push-out lives in the API, and the rule lives in `domain/goalDetail.ts`** (`pushedDates(milestones, movedId, newDate, deadline)`), which the client calls. The real API will own this later; until then one pure function, unit-tested, keeps the mock and any optimistic preview in agreement.
- **Week numbers:** "Wk N" counts the goal's start week as Wk 1 (`floor(days / 7) + 1`). The spec's two examples disagree ("Wk 8 · Nov 30" and "Week 12 · Dec 7"), so the Task 3 tests settle it and the spec's examples get fixed.
- **The page is one view object.** `goalPage(detail, today)` returns `{ kind: 'current' | 'reached' | 'ended', … }`, so a reached or ended goal can't show Pause or Check in by mistake.
- **`condenseTimeline(rows)`** is separate and pure. It always shows the latest hit milestone, every not-yet one, Next and the Goal row, and folds the runs between them into labelled rows ("Start and 1 hit milestone", "2 more: Wk 16, No date").
- **Show all is remembered per goal** in `storage/timelinePreference.ts`: one `localStorage` key holding the expanded goal IDs, guarded like `viewPreference.ts`.
- **Save failures reload the goal.** `useGoal` changes the page at once. If a save fails it reloads from `getGoal` and shows "Couldn't save that. Try again." every time. This avoids #17's "only the newest save rolls back" race from the start, so `useGoal` has no `latestSave` counter. Pause, Resume, End and Go again change several things at once, so they wait for the save and then reload, as Bring back does.
- **Sheets are their own components** (`TargetSheet`, `AddMilestoneSheet`, `CheckInSheet`, `EndGoalSheet`, plus the date and line fields the not-yet choices need) on the native `<dialog>` pattern (`useModalDialog`, `sheet.css`). The screen holds one `openSheet` state and nothing is open on first render.
- **The not-yet card comes from data**: it shows while Next is `notYet`, so the mock's Be strong milestone 2 shows it on first open, and a reload brings it back. It's never shown anywhere but this screen.
- **Hit it on the Goal row** calls `endGoal(id, 'reached')`. On the Goal row, Not yet closes the sheet and changes nothing.
- **Resume vs Go again:** both are `resumeGoal`. From paused, it returns this week's skipped tasks for the goal to the bank (status `inBank`, no `plannedDay`, no `placedByHand`). From ended, it only clears `endedAt`. Ending never touches tasks.
- **Other goals take in a retired aspiration's current goals.** `otherGoals` in `domain/aspirations.ts` includes active and paused goals whose aspiration is retired (decision 5). The retired aspiration's page shows such a goal as active, not "Paused".
- **The aspiration link** gets an `onOpenAspiration` prop. Back from that aspiration goes to the tab, as it does today.

## Phases

1. **PR 1: API and domain:** `getGoal`, target and milestone writes, `goalPage`, `condenseTimeline`. → Checkpoint A.
2. **PR 1: the screen:** shown, then the target sheet and Add milestone. → Checkpoint B (on the phone), then PR 1.
3. **PR 2: API:** check-in and reopen with push-out, pause / resume / end, Other goals. → Checkpoint C.
4. **PR 2: the screen:** check-in and the not-yet card, then Pause / End / Go again, then docs. → Checkpoint D, then PR 2.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Push-out moves the wrong milestones (earlier ones, undated ones, another goal's) or goes past the deadline | High | `pushedDates` is pure and tested on each case before the client uses it. |
| Skipped tasks don't come back cleanly on Resume (a day kept, or other skipped tasks revived) | High | Resume only touches this week's skipped tasks for that goal; tests read `getBank` and `getDay` after a pause and a resume. |
| A resumed goal under a retired aspiration sorts or shows oddly on Today, Week or the aspiration page | Med | Task 8 tests the tab, the retired page and `goalsByPriority` with such a goal. |
| Condensed timeline doesn't fit Check in above the fold at 375 px | Med | Checked on the phone at Checkpoint B with Be strong (five milestones). |
| One-off check-in from any row clutters the timeline | Low | The row itself is the button, with no extra control. Checked at Checkpoint D. |
| Wording drifts toward judgment ("missed", "overdue", "behind") | Med | Strings come from the spec and are tested verbatim. A passed date shows no badge. |
| Mock store leaks between tests | Med | `resetStore()` in `beforeEach` in every new test file. |

## Verification

Every task: tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026. Doc changes in the parent repo get their own branch and PR there, one for each front-end PR.

## Open questions

None. Settled on 2026-11-10 (above).
