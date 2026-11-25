# Implementation Plan: Delete what was made by mistake (#38)

Spec: [`../specs/038-delete-mistakes.md`](../specs/038-delete-mistakes.md). Issue: [#38](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/38). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

A task, a milestone, a goal, an aspiration or a recurring item can be deleted. Delete is always the last choice, in plain text. It asks once in a sheet that says what goes with it, waits for the server (it isn't queued), then reads the screen's record again, or leaves the page for a goal or an aspiration. Offline, or on any failure, nothing changes and "Couldn't delete that. Try again." shows. A 404 counts as done.

## Architecture decisions

- **Client functions:** `deleteTask`, `deleteGoal` (`realPlan.ts` / `realGoals.ts`), `deleteMilestone` (returns `GoalDetail`, as every milestone write does), `deleteAspiration` (`realAspirations.ts`), `deleteRecurringItem` (`realPlan.ts`). `request.ts`'s `Method` gains `'DELETE'`. Not queued, so each waits for the queue's send in progress first, as other unqueued writes do. The types are already generated (076 regenerated them).
- **The mock** cascades as `api/specs/delete.md`'s table: it removes the rows from the store. A task takes nothing with it. A milestone takes its check-ins and the rest are renumbered. A goal takes its tasks, milestones, check-ins, targets and quit days, and empties a recurring item's `fromGoalId`. An aspiration leaves its goals and items with no aspiration, and the rest are renumbered. A recurring item takes its open tasks and empties the item link on the rest. An unknown id throws `NotFoundError`.
- **`domain/deleting.ts`:** each confirmation's wording, from the spec's item 2: `deleteTaskLine(title)`, `deleteGoalLine(title)` and so on.
- **`hooks/useDelete.ts`:** one hook for every place. It takes `send: () => Promise<unknown>` and `done: () => void | Promise<void>`. It holds `asking`, `ask()`, `cancel()`, `confirm()` and `message`. `confirm` waits for `send`: on success or on `NotFoundError` it closes and calls `done`. On any other failure it closes and sets "Couldn't delete that. Try again.", and nothing else changes. A second tap while one is on its way does nothing. Each screen hook decides what to send and what `done` does.
- **`components/DeleteSheet.tsx`:** one native `<dialog>` (`useModalDialog`, `useBackdropClose`) with the wording passed in. **Cancel** comes first and has focus; **Delete** comes second, as a plain button, never the default.
- **What `done` does:**
  - Task: the week is read again (`useStoredWeeks`'s `reload`, exposed by `useDay` and `useWeek`).
  - Milestone: shows the `GoalDetail` the API returned (`setData`), as other milestone writes do.
  - Goal: forgets `goal/<id>` in `planStore().responses` and calls `onBack` (back to where it was opened from).
  - Aspiration: forgets `aspiration/<id>` and goes to the Aspirations tab.
  - Recurring item: closes the edit sheet and calls the list's `reload`.
- **Where Delete sits:**
  - `TaskMenu` gains an optional `onDelete`, shown last as **Delete (made by mistake)**.
  - The Week bank's `DayPickerSheet` gains an optional `onDelete` under the days.
  - Goal page: milestone rows open a new `MilestoneSheet` with Check in (when the row is checkable) and **Delete milestone**. The goal's own row keeps opening check-in directly.
  - **Delete goal** goes under the goal's other actions.
  - **Delete aspiration** goes at the bottom of `AspirationEditSheet`.
  - **Delete** goes under Pause/Resume in `RecurringEditSheet`.
  - Each one opens the `DeleteSheet` in place of its own sheet (one sheet at a time).

## Settled with Jan, 2026-11-25

1. **Fixed-day tasks, which today have no ⋯ menu, get one holding only Delete.** Decision 5 says Delete is offered on tasks the app placed, and this is the only way to reach them. Done tasks still have no menu, as today.
2. **A goal's Delete shows in every state** (current, paused, reached, ended), always last.
3. **A task's Delete is offered on Today and an opened day, past days included**, wherever its menu shows.

## Tasks

1. **Client functions and the mock.** The `DELETE` method, five functions (real and mock), and the mock's cascade. Tests:
   - each real request's method and path, and `deleteMilestone` returning the page;
   - the mock: each table row goes, what stays stays, positions renumber, and an unknown id gives 404.

   Files: `api/request.ts`(+test), `api/realPlan.ts`, `api/realGoals.ts`, `api/realAspirations.ts`(+tests), `api/client.ts`(+test). (M)
2. **The wording, the hook and the sheet.** `domain/deleting.ts`(+test), `hooks/useDelete.ts`(+test), `components/DeleteSheet.tsx`. Hook tests:
   - asks, then sends once;
   - Cancel sends nothing;
   - success calls `done`;
   - a 404 counts as done;
   - a failure shows the message and doesn't call `done`;
   - a second confirm while one is on its way does nothing.

   (M)
3. **Delete a task on Today and an opened day.** `TaskMenu`'s last item, `TaskRow` (fixed tasks get a Delete-only menu), `useDay.deleteTask`, and `Day.tsx` shows the sheet. Screen tests:
   - Delete asks with the task's name and the task leaves the day and the count;
   - Cancel keeps it;
   - offline, it stays, with the message;
   - a fixed task can be deleted.

   (M)
4. **Delete a bank task on Week.** `DayPickerSheet`'s `onDelete`, `useWeek.deleteTask`, `Week.tsx`. Screen tests: it leaves the bank and its count; a failure leaves it with the message. (S)
5. **Delete a milestone.** `components/MilestoneSheet.tsx`, `GoalDetail.tsx`'s rows, `useGoal.deleteMilestone`. Screen tests:
   - every milestone row opens the sheet, and Check in shows only when the row is checkable;
   - the deleted milestone leaves the timeline and the count;
   - a failure keeps it.

   (M)
6. **Delete a goal.** `useGoal.deleteGoal` (forgets the stored response) and `GoalDetail.tsx`'s last action. Screen and app tests:
   - asks with the goal's name and "There's no undo";
   - on confirm, goes back to where it was opened from;
   - the goal is gone from its aspiration's page, and its tasks are gone from the week (mock);
   - offline, it stays.

   (M)
7. **Delete an aspiration.** `AspirationEditSheet`'s bottom Delete, `useAspiration.deleteAspiration` (forgets the stored response), `Aspiration.tsx`, and the route to the tab in `App.tsx`. Tests:
   - after confirming, the app is on the Aspirations tab;
   - the aspiration's goals show under Other goals;
   - its items show on Keep life running;
   - a failure stays on the page with the message.

   (M)
8. **Delete a recurring item.** `useRecurringEdit.deleteItem` and the Delete under Pause in `RecurringEditSheet`. Tests (hook and Upkeep/Aspiration screens): it leaves the list; its open tasks leave the week (mock); a failure keeps the sheet's list as it was, with the message. (S)
9. **Docs and the check.** `../docs/screens/README.md` (each screen's Delete; the "Not yet on screen" line goes) and `../docs/flows.md` item 9 ("No screen offers delete yet" goes). Spec 038 and the specs index marked built. A Sonnet agent runs the spec's manual checks at phone width against the local API. (S)

### Checkpoints

- After 2: tests, lint and build pass; nothing on screen yet.
- After 4: a task can be deleted from Today, a day and the bank.
- After 8: all five deletes work in `npm run dev:mock`.
- After 9: the manual check passes; PR opened with "Closes #38".

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A queued change for a task waits when that task is deleted | Low | Delete waits for the queue's send in progress (`afterQueue`). A later 404 on a queued change already counts as done (043b). |
| A milestone tap now opens a sheet before check-in (one tap more) | Low | Settled in decision 1. The goal's own row still opens check-in directly. |
| The mock cascade drifts from the API's | Low | Tests follow `api/specs/delete.md`'s table row by row. The manual check runs on the real API. |
