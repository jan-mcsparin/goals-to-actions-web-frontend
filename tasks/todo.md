# Tasks: Goal detail (#5)

Plan: [`plan.md`](plan.md). Spec: [`../specs/005-goal-detail.md`](../specs/005-goal-detail.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026. New test files call `resetStore()` in `beforeEach`.

# PR 1: `goal-detail-view`

## Phase 1: API and domain

### Task 0: Settle spec 005

**Description:** Bring the spec in line with the plan's settled decisions 1–9: close the open questions, drop Review, add the not-yet-stays-Next rule, push-out with the deadline cap, one-off steps in any order, `reopenMilestone` returning `Milestone[]`, and Wk 1 as the start week (fix the two examples). Mark the spec approved.

**Acceptance criteria:**
- [x] No open questions left; each decision is in the section it changes.
- [x] Review, `reviewGoal` and the Review sheet are gone from the spec, its tests and its success criteria.

**Verification:**
- [x] Read through against `plan.md`; `npm test && npm run lint && npm run build` still pass (no code change)

**Dependencies:** None

**Files:** `specs/005-goal-detail.md`, `specs/README.md` (if the shared decisions mention Review), `tasks/plan.md`, `tasks/todo.md`

**Scope:** XS

### Task 1: `getGoal`

**Description:** Add `GoalDetail` (`goal`, `aspiration?`, `milestones` in order, `weeklyTarget?` in force this week whatever the goal's status) and `getGoal(goalId)`, which throws `NotFoundError` for an unknown id.

**Acceptance criteria:**
- [ ] Be strong returns Be fit, its five milestones in order (milestone 2 is `notYet`) and the 3 lifting sessions target.
- [ ] Renew my passport has no aspiration; Cook at home (paused) has no target and still loads.
- [ ] An unknown id rejects with `NotFoundError`; the result is a copy.

**Verification:**
- [ ] `npm test`: a `getGoal` block in `client.test.ts`

**Dependencies:** Task 0

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 2: `setWeeklyTarget` and `addMilestone`

**Description:** `setWeeklyTarget(goalId, amount, unit)` adds a row effective this Monday, or updates that row if it already exists. `addMilestone(goalId, { measurableLine, targetDate? })` appends an upcoming milestone after the goal's last one.

**Acceptance criteria:**
- [ ] A target changed twice this week leaves one row for this week and keeps the October row; `getWeek` shows the new amount. An amount below 1, a blank unit, or a goal that isn't building rejects.
- [ ] A new milestone is last and upcoming; a blank line, an unknown goal, or a reached or ended goal rejects.

**Verification:**
- [ ] `npm test`: `client.test.ts`, one block per function

**Dependencies:** Task 1

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 3: `domain/goalDetail.ts`: the page

**Description:** `goalPage(detail, today)` returns `current | reached | ended` with: header (type label, "Paused", aspiration link), started/latest lines, timeline rows (Start, milestones, Goal) with status, `weekLabel` and Next, the "1 of 6 hit" count, the target section (by type), and next check-in. Also `pushedDates(milestones, movedId, newDate, deadline?)` for PR 2, since it's pure and belongs here.

**Acceptance criteria:**
- [ ] Next is the first milestone that isn't hit, so Be strong's not-yet milestone 2 is Next. With all hit, or none, the Goal row is Next and "0 of 1 hit" for no milestones. One-off goals say "Steps" and every not-done step is checkable.
- [ ] Week labels count the start week as Wk 1; "No date"; Latest is the last hit or not-yet result with its date, and is left out when there's none; no baseline leaves the section out; target section: amount and unit, "No weekly target yet", "Deadline: …" for one-off, "Since Oct 5" for quitting.
- [ ] `pushedDates`: later dated milestones move by the same days, capped at the deadline; earlier and undated ones don't move; moving earlier pulls nothing in; one-off goals move only the step itself.

**Verification:**
- [ ] `npm test`: new `domain/goalDetail.test.ts`; existing domain tests still pass

**Dependencies:** Task 1

**Files:** `src/domain/goalDetail.ts`, `src/domain/goalDetail.test.ts`

**Scope:** M

### Task 4: `condenseTimeline` and the Show all preference

**Description:** `condenseTimeline(rows)` keeps the latest hit milestone, every not-yet one, Next and the Goal row, and folds the runs between them into labelled fold rows. `storage/timelinePreference.ts` remembers expanded goal IDs.

**Acceptance criteria:**
- [ ] Four milestones or fewer: no folding, no toggle. Be strong condenses to Start, milestone 1 (latest hit), milestone 2 (not yet, Next), "3 more: Wk 9, No date, No date", Goal. A run of one row shows the row itself rather than a fold.
- [ ] A not-yet milestone is never folded; all hit and none hit both give sensible rows.
- [ ] The preference round-trips per goal and falls back to collapsed when storage throws or holds junk.

**Verification:**
- [ ] `npm test`: `goalDetail.test.ts` (a `condenseTimeline` block), new `storage/timelinePreference.test.ts`

**Dependencies:** Task 3

**Files:** `src/domain/goalDetail.ts`, `src/domain/goalDetail.test.ts`, `src/storage/timelinePreference.ts`, `src/storage/timelinePreference.test.ts`

**Scope:** S

## Checkpoint A
- [ ] Tests, lint and build pass
- [ ] Today, Week, the tab and the aspiration page behave as before

## Phase 2: The screen

### Task 5: `useGoal` and the screen, shown

**Description:** `useGoal(goalId, today)` loads, reports `notFound`, and returns the page and the Show all state. `GoalDetail.tsx` replaces the placeholder: pinned header with back named for where it came from, type, aspiration link; Started at / Latest; the timeline condensed or expanded (fold rows and Show all / Show less toggle); target; next check-in. Buttons that open PR 2's sheets aren't there yet. `App.tsx` passes `onOpenAspiration`, and a missing goal goes back to Aspirations.

**Acceptance criteria:**
- [ ] Be strong renders its header, "‹ Be fit" or "‹ Aspirations" by origin, "Be fit ›" opens the aspiration, and the timeline opens condensed.
- [ ] A fold row and Show all expand it; Show less collapses it; reopening the goal restores the choice.
- [ ] A remembered goal that doesn't exist lands on Aspirations; no dialog is open on first render.

**Verification:**
- [ ] `npm test`: new `hooks/useGoal.test.tsx` (load, not found), new `screens/GoalDetail.test.tsx`, `App.test.tsx`
- [ ] Manual: `npm run dev`, open Be strong and the garage goal at 390 px

**Dependencies:** Tasks 2, 4

**Files:** `src/hooks/useGoal.ts`, `src/hooks/useGoal.test.tsx`, `src/screens/GoalDetail.tsx`, `src/screens/GoalDetail.css`, `src/screens/GoalDetail.test.tsx`, `src/App.tsx`, `src/App.test.tsx`

**Scope:** M (at the top end; split the CSS into a follow-up commit if needed)

### Task 6: Target sheet and Add milestone

**Description:** **Edit** or **Set** opens `TargetSheet` (amount, a whole number of at least 1, and a unit). **+ Add milestone** or **+ Add step** opens `AddMilestoneSheet` (a line and an optional `<input type="date">`, max the deadline). Both save optimistically through `useGoal`; on failure the hook reloads and shows "Couldn't save that. Try again."

**Acceptance criteria:**
- [ ] Changing Be strong's target to 4 shows at once, and Week reads "of 4".
- [ ] A new milestone appears last on the timeline (expanding a condensed one isn't required) and the count becomes "1 of 7 hit".
- [ ] A failed save reloads the goal and shows the message each time (hook test with a rejecting client).

**Verification:**
- [ ] `npm test`: `GoalDetail.test.tsx`, `useGoal.test.tsx`

**Dependencies:** Task 5

**Files:** `src/components/TargetSheet.tsx`, `src/components/AddMilestoneSheet.tsx` (+ `.css`), `src/hooks/useGoal.ts`, `src/hooks/useGoal.test.tsx`, `src/screens/GoalDetail.tsx`, `src/screens/GoalDetail.test.tsx`

**Scope:** M

## Checkpoint B (PR 1)
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: Be strong condensed has the target and Next check-in visible without scrolling; long lines wrap; sheets clear the keyboard and the home indicator
- [ ] Parent-repo docs: Flow 6's timeline, the condensed view and target editing as built (own branch and PR)
- [ ] Spec status updated; PR 1 opened referencing #5 (not closing it); review with Jan before PR 2

# PR 2: `goal-detail-actions`

## Phase 3: API

### Task 7: `checkInMilestone` and `reopenMilestone`

**Description:** `checkInMilestone(id, 'hit' | 'notYet', result?)` sets status, result and `checkedInOn`. For building and quitting goals only the first milestone that isn't hit can be checked in; for one-off, any step that isn't done. `reopenMilestone(id, changes?)` returns a not-yet milestone to upcoming, applies a new line or date, pushes later ones out with `pushedDates`, and returns the goal's milestones.

**Acceptance criteria:**
- [ ] Hit on Be strong milestone 2 makes milestone 3 Next; checking in milestone 4 before 3 rejects for Be strong but works for the garage's step 5.
- [ ] Moving milestone 2 three weeks later moves milestone 3 by three weeks and leaves 4 and 5 undated; with a deadline, nothing passes it.
- [ ] Rejects a hit milestone, an unknown id, a blank line, reopening one that isn't not-yet, and anything on a reached or ended goal.

**Verification:**
- [ ] `npm test`: `client.test.ts`

**Dependencies:** Checkpoint B

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 8: `pauseGoal`, `resumeGoal`, `endGoal`, and Other goals

**Description:** Pause: active → paused, its waiting tasks this week → skipped (day kept). Resume: from paused, those skipped tasks → bank; from ended, clears `endedAt`. End: `reached` or `ended`, sets `endedAt`, tasks untouched. `otherGoals` takes in current goals whose aspiration is retired; the retired aspiration's page shows such a goal as active.

**Acceptance criteria:**
- [ ] Pause Be strong: its tasks leave `getDay`, `getBank` and Week's progress; done ones stay. Resume: they're in `getBank` with no day, and other goals' skipped tasks are untouched.
- [ ] End as reached and as ended set status and `endedAt` and move no tasks; Go again on an ended goal makes it active. Pausing a paused, reached or ended goal rejects, as does resuming an active one.
- [ ] After retiring Be fit with "Pause them" and resuming Be strong: it's under Other goals on the tab, active on Be fit's retired page, and Today and Week still render it.

**Verification:**
- [ ] `npm test`: `client.test.ts`, `domain/aspirations.test.ts`, `domain/aspiration.test.ts`, `domain/today.test.ts` if sorting needs a case

**Dependencies:** Task 7

**Files:** `src/api/client.ts`, `src/api/client.test.ts`, `src/domain/aspirations.ts`, `src/domain/aspirations.test.ts`, `src/domain/aspiration.ts`, `src/domain/aspiration.test.ts`

**Scope:** M

## Checkpoint C
- [ ] Tests, lint and build pass
- [ ] Today, Week, the tab, the aspiration page and Keep life running behave as before with the mock unchanged

## Phase 4: The screen

### Task 9: Check in and the not-yet card

**Description:** **Check in** (or tapping any not-done step of a one-off goal) opens `CheckInSheet`: the milestone's line, "How did it go?", an optional result, **Hit it** / **Not yet** (**Done** / **Not yet** for steps). Hit shows "Milestone hit: …" and Next moves on. The Goal row's Hit it marks the goal reached; its Not yet changes nothing. While Next is not yet, the card shows under Next check-in, leading with "You started at … Now: …", with **Keep the date**, **Move the date** and **Adjust the milestone**, each returning it to upcoming.

**Acceptance criteria:**
- [ ] Opening Be strong shows the not-yet card for milestone 2 (from the mock), leading with the baseline and its result; each of the three choices clears it, and Move the date pushes milestone 3 out.
- [ ] Hit it on milestone 2 makes milestone 3 Next; with every milestone hit, Hit it on the goal shows it reached. A garage step out of order can be marked Done.
- [ ] No "missed", "failed", "behind" or "overdue" anywhere (a test scans the rendered text).

**Verification:**
- [ ] `npm test`: `GoalDetail.test.tsx`, `useGoal.test.tsx`

**Dependencies:** Checkpoint C

**Files:** `src/components/CheckInSheet.tsx`, `src/components/NotYetCard.tsx` (+ `.css`), `src/hooks/useGoal.ts`, `src/screens/GoalDetail.tsx`, `src/screens/GoalDetail.test.tsx`

**Scope:** M

### Task 10: Pause, Resume, End and Go again

**Description:** Actions row **Pause · End goal** (Pause reads Resume when paused). `EndGoalSheet` leads with Started at / Latest and "2 of 6 milestones hit", then **I reached it**, **End it for now**, **Cancel**. Reached reads "Reached Nov 10" and "What's next for Be fit?"; ended reads "Not yet." with the same lines and **Go again**. These wait for the save, then reload.

**Acceptance criteria:**
- [ ] Pause then Resume: tasks leave Week, then return to the bank; the tab reads "Paused" in between.
- [ ] End as reached and as ended show their states, with no Pause, Check in or Add milestone; Go again makes the goal active.
- [ ] A failed save leaves the page as it was with the message.

**Verification:**
- [ ] `npm test`: `GoalDetail.test.tsx`, `App.test.tsx` (the tab reflects Pause)

**Dependencies:** Task 9

**Files:** `src/components/EndGoalSheet.tsx` (+ `.css`), `src/hooks/useGoal.ts`, `src/screens/GoalDetail.tsx`, `src/screens/GoalDetail.test.tsx`, `src/App.test.tsx`

**Scope:** M

### Task 11: Docs

**Description:** Parent repo (own branch and PR): Flow 6 (check-in, not yet stays next, push-out capped at the deadline, steps in any order), Flow 7 (Pause / Resume / End, Go again, no goal Review), `data-model.md` if it mentions goal review, and the screen inventory. Front end: spec 005 marked built, `specs/README.md` moves 005 to Done.

**Acceptance criteria:**
- [ ] No doc still describes goal Review, or a not-yet milestone being passed over.
- [ ] Every rule in plan decisions 5–9 appears in `docs/`.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`; read-through of the parent diff

**Dependencies:** Task 10

**Files:** `../docs/flows.md`, `../docs/data-model.md`, `../docs/screens/README.md`, `specs/005-goal-detail.md`, `specs/README.md`

**Scope:** S

## Checkpoint D (PR 2)
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: check-in sheet, not-yet card with a date picker, End sheet; nothing opens unprompted
- [ ] PR 2 opened, closing #5; the parent-repo docs PR linked
