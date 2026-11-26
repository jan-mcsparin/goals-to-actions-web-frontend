# Implementation Plan: Move or remove a future day's set items (#82)

Spec: [`../specs/082-move-and-remove.md`](../specs/082-move-and-remove.md). Issue: [#82](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/82). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

An opened day's set items (hand-added, unfinished, today or later) get **Move to another day** (any week, native date input) and **Remove (not doing it)** (a drop, asked once, not queued). A fixed-day task gets **Move to another day** within its week, with an API change to `place`. A day of a week that hasn't opened shows its set tasks with menus and its known items under "Also that day".

Three PRs, in this order:

1. **API** (`goals-to-actions-api`, branch `move-fixed-day`, "Part of web-frontend#82"): task 1.
2. **Front end** (`goals-to-actions-web-frontend`, branch `move-and-remove`, closes #82): tasks 2–7, 9. Merges after the API PR.
3. **Docs** (`goals-to-actions`, branch `move-and-remove-docs`): task 8's `docs/` part.

## Architecture decisions

- **The API change is one line of rule:** `place` drops its `keep_on_its_day` call. `move_to_bank` and `swap` keep it. `rework` already leaves a `by_hand` row alone (`app/turnover/rework.py`), so a moved fixed-day task stays put after its item is edited; tests prove it rather than new code. `fixedDay` stays true on the moved task (it's computed from the item and `carried_over`), so the front end still keeps it out of the bank and Swap.
- **A cross-week move in replay:** a `place` change gains an optional `task` (the task as it was when moved). `replay` on the week named by `change.week`: a day inside that week moves the task as now; a day outside takes the task out. On another stored week whose Monday is the day's: the task is added there from `change.task` (placed by hand, that week), unless the week already has it. Older queued changes have no `task`, which only means they don't land early. Stored weeks are only the current and an open next week, so "lands at once" covers this week ↔ next week; further out, it just leaves.
- **What's offered is decided in `domain/tasks.ts`:** `isSetItem(task, today)` (as the spec's snippet) and `canMoveInWeek(task, today)` (fixed-day, open, on a day; its week has a day from today on). `TaskRow` gets the domain's answers through `row`-level props, as now with `row.fixed`.
- **Remove reuses `useDelete`** with a `failure` message passed in (default `DELETE_FAILED`), sending `dropTask` and reloading on done. 404 counts as done, as for Delete. `DeleteSheet` takes `confirmLabel` (default "Delete"); the question comes from `domain/deleting.ts` (`removeTaskLine`).
- **Move's message** is "Moved to Sat, Dec 19." from 079's day label (`dayLabel` in `domain/goalDetail.ts`), shown through `setMessage` as other screen messages.
- **The mock's `placeTask`** takes a bank or day task: within its week as now (a fixed-day one too); to another week for `byHand` only (a `ConflictError`/409 otherwise, as the API), keeping the rule that a target week can't already hold it. `dropTask` sets `dropped`.
- **A not-open day** is drawn in a new `domain/notOpenDay.ts`: `notOpenDayOf(week, date)` → `{ tasks: TaskRow[], alsoThatDay: string[] }`. A check-in reads "Check in: Lift · Milestone 3 of 4" from `CheckInDate`'s `position` and `of`; Week's day line keeps its shorter "Check in: Lift". `Day.tsx` renders it when `week.status === 'notOpen'`.

## Task list

See [`todo.md`](todo.md). Each task: failing test first, then code, then the checks (front end: `nvm use`, `npm test`, `npm run lint`, `npm run build`; API: ruff check, ruff format --check, mypy, pytest), then one commit.

1. **API: a fixed-day task moves within its week.** Remove `keep_on_its_day` from `place`; `Task.fixedDay` and `placeTask` descriptions; `uv run python -m app.openapi`. Tests: to tomorrow and back; to another week (409); bank and swap still 409; after the move, renaming its item and changing its schedule leave it on the new day; sent twice. Docs in the API repo: `specs/on-a-day.md`, `specs/tasks-week.md`. Files: `app/tasks/rules.py`, `app/tasks/models.py`, `openapi.json`, `tests/test_tasks*.py`, `tests/test_recurring_edit*.py`, `tests/test_repeats.py` if needed, two specs.
2. **Types and the client.** `npm run api:types`; `dropTask` in `realPlan.ts` and `client.ts`; the mock's `placeTask` as above. Files: `openapi.ts`, `realPlan.ts`, `client.ts`, `client.test.ts`, `realPlan.test.ts`.
3. **What's offered, and the move in replay.** `isSetItem`, `canMoveInWeek`; `place`'s optional `task` and the cross-week rule. Files: `domain/tasks.ts`, `tasks.test.ts`, `domain/replay.ts`, `replay.test.ts`.
4. **The hook.** `useDay`'s `move(taskId, day)` (queued `place`, with `task` when the day is in another week; the "Moved to …" message) and `removing` (`useDelete` with `dropTask` and its own failure). Files: `useDay.ts`, `useDelete.ts`, `domain/deleting.ts`, `useDay.test.tsx`, `deleting.test.ts`.
5. **The menu and the sheets.** `TaskMenu`'s `onMove`/`onRemove` in the spec's order; `MoveSheet` (date input, `min` today, Move off until the day differs); `DayPickerSheet`'s `title`; `DeleteSheet`'s `confirmLabel`; `TaskRow` and `Day.tsx` wiring, a fixed-day task's Move opening the day picker with its week's days from today on. Files: `TaskMenu.tsx`, `MoveSheet.tsx`, `DayPickerSheet.tsx`, `DeleteSheet.tsx`, `TaskRow.tsx`, `Day.tsx`, `Day.test.tsx`.
6. **A day of a week that hasn't opened.** `notOpenDay.ts`; `useDay` gives it; `Day.tsx` shows the note, set tasks with menus, "Also that day", "Nothing set yet", no progress, check-off, Pull or Swap. Files: `domain/notOpenDay.ts` (+ test), `useDay.ts`, `Day.tsx`, `Day.css`, `Day.test.tsx`.
7. **Checkpoint:** full suite, lint, build; the flows on `npm run dev:mock` by test only (Jan runs the dev servers).
8. **Docs.** Root repo: `docs/screens/README.md` (Today's menu, Week's opened day, Remove beside Delete), `docs/flows.md` flow 3 ("Later weeks"), flow 7 (Remove is a drop), line 73 (a moved fixed-day task stays), `docs/data-model.md` line 296, the brief's status line and its FE 4 note. Front end: `specs/README.md`, the spec's status, `CLAUDE.md` (place can move across weeks; Remove beside Delete in the deletes rule).
9. **The check.** A sonnet agent at 390 px against the local API and dev server (already running), as the spec's Testing says; findings fixed or reported; a "Checked" note in the spec.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The front end's types need the API branch before it merges | Med | Generate from the local `move-fixed-day` branch; the FE PR says it merges after the API PR. |
| A queued cross-week move whose task was already in the other week (two devices) shows twice | Low | The receiving week adds it only when it doesn't have that id. |
| Remove sent offline | Low | Not queued: it fails and says "Couldn't remove that. Try again.", as Delete. |
| The live check needs the API branch running | Med | The agent checks against the local API on `move-fixed-day`; I'll say if the running API isn't on it. |

## Open questions

None.
