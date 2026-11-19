# Implementation Plan: Tasks as the API has them, Next week and wrap-up, "Still matter?" (#30, #46, #35)

Issues: [#30](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/30), [#46](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/46), [#35](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/35); no spec of their own. The contract and its rules are in the API's [`week-turnover` spec](../../api/specs/week-turnover.md) and [plan](../../api/tasks/plan.md), planned alongside this one. Tasks: [`todo.md`](todo.md). (The plan for #34 is in git history.)

## Overview

Three pieces, still on mock data. Screens move to the API in #42, after the planner.

1. **#30: a task is the API's `Task`.** `status` (`inBank | planned | done | skipped`), `weekOf` and `rolloverCount` go. A task has a `state` (open, done, dropped, lapsed), an `origin`, and the week, day and placed-by-hand of its row in play. "Skipped" becomes "set aside" in code, and the client's plan functions take the API's names. Nothing changes on screen. This needs nothing from API #9 and can start now.
2. **#46: Next week, and wrap-up.** From 6 p.m. on Sunday, Week offers **Next week**. Its tasks can be placed, sent to the bank and swapped, but not checked off. **Wrap up this week** opens a sheet listing what carries over and what ends with the week, read from each task's `atClose`. Confirming makes next week the current one.
3. **#35: "Still matter?".** A task the API marks `stillMatters` shows a card with Keep, Reschedule and Drop, sent through `answerStillMatters`.

Rolling over and lapsing happen on the server (ADR-008); #35's rules are built and tested in API #9. The phone only shows what the week read says, so no rollover rules go into `domain/`.

**Two PRs:** `tasks-as-api` (closes #30; tasks 1–3), which can go now; and `next-week` (closes #46 and #35; tasks 4–8), after the API's `week-turnover` PR is merged.

## Decisions

- **The task-state readers go through one module first.** Today 266 lines across about 20 files read `status`, `weekOf` or `rolloverCount` directly. Task 1 moves every reader onto `domain/tasks.ts` (`isOnDay`, `isInBank`, `isDone`, `isSetAside`, `weekOf`) over the old type. Then task 2's type swap only changes that module, the mock and the client. The recurring-items swap was one commit; this one is too big to be.
- **The mock stores a little more than the API sends.** `StoredTask` is the generated `Task` plus `setAside: boolean`, as `StoredGoal` is today. The API's set-aside task reads with no week, the same as an upcoming one, and the mock needs to tell them apart to bring them back.
- **Client names match the API's operations:** `skipTask` becomes `moveTaskToBank`, `pullFromBank` becomes `placeTask`, and `swapTask` becomes `swapTasks`, returning `{ toBank, placed }`. Each plan edit sends the week it was made in (shared decision 14). That's the shape #42 calls, so it won't rename them again.
- **`getWeek(week)` takes the week.** It returns `isCurrent` and `nextWeekOpen` as the API's `Week` does. The rest of `WeekPlan` (goals, aspirations, items) stays hand-written until #42 moves Week to the API's read.
- **The mock opens next week from the device clock** at 6 p.m. on Sunday, as the API does from the phone's time zone. The mock's wrap-up uses `atClose` and nothing else: "carriesOver" moves a task to next week's bank, and "ends" closes it. That's the server's answer, applied, not a rule.
- **Next week is a view on Week:** a "This week | Next week" toggle at the top (the `ViewToggle` Today already uses), shown only once next week is open. The view is remembered across reloads, as Today's is. There's no sketch of Next week yet; this is the smallest thing that fits the Week screen.
- **"Still matter?" is a card at the top of Today,** one per marked task, above the plan. Reschedule opens the day picker the bank already uses. Flow 7 doesn't say where the card goes; Today is where the person looks every day, and the card is quiet and can be ignored.

## Task list

PR `tasks-as-api` (closes #30):

- [x] Task 1: Read task state through one module
- [x] Task 2: Use the generated Task everywhere
- [x] Task 3: Plan functions take the API's names and the week

Checkpoint after task 3: build, lint and tests pass, and the screens look as they did at iPhone width.

PR `next-week` (closes #46 and #35), after the API's `week-turnover` is merged:

- [ ] Task 4: New types, and a mock that opens next week
- [ ] Task 5: Next week on the Week screen
- [ ] Task 6: Wrap up this week
- [ ] Task 7: The "Still matter?" card
- [ ] Task 8: Docs and the phone check

Checkpoint after task 6: Next week and wrap-up click through on mock data.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Task 1 misses a reader, and task 2's swap breaks it | Med | The compiler finds it in task 2, since `status` leaves the type. Task 1 also greps for the old field names. |
| A set-aside task shows on a day after the swap | Med | `isSetAside` has its own tests, and the pause and resume tests in the client stay as they are. |
| The API's `Task` shape changes while #9 is built | Low | Task 4 regenerates after #9 is merged, not before. |
| The Next week toggle crowds the Week header on a small phone | Low | Task 8's phone check at iPhone width (a Sonnet agent with the browser). |

## Assumed, for review with this plan

1. Next week is a toggle on Week, not its own screen.
2. The "Still matter?" card sits at the top of Today.
3. #35's acceptance criteria about rolling over and lapsing are met and tested in API #9; here, only the card and the mock are built.
4. The mock doesn't place a new goal's sessions on days (ADR-013 leaves that to the planner, #10); they stay in the bank as they do now.
