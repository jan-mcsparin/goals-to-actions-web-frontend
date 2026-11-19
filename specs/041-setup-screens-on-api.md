# Spec: Setup screens on the API (#41)

Status: approved 2026-11-18; plan in [`../tasks/plan.md`](../tasks/plan.md). Issue: [#41](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/41). Module `setup-screens-on-api` in the [map](README.md). Depends on the API's [`goals-targets`](../../api/specs/goals-targets.md) and [`milestones-check-ins`](../../api/specs/milestones-check-ins.md) slices, and on a small API change (decisions 1, 4 and 5 below).

## Objective

With the switch on real, what the person sets up is kept: aspirations, goals, weekly targets, milestones and check-ins are read from and saved to the API on the Aspirations tab, an aspiration's page, a goal's page and the Add sheet's goal form.

This takes in #33 (each check-in its own record) in full, and the data shape of #32 (a target's `kind`, `sessions`, `amount`) with count targets only. Mock stays the default; the click-through looks as it does now.

### What exists afterwards

1. **Goals, weekly targets and milestones come from the generated types.** The hand-written `Goal`, `Milestone`, `WeeklyTarget`, `NewGoal` and `GoalDetail` go. The mock is reshaped to match: `endedOn`, not `endedAt`; no `lastReviewedAt`; `slipped`; the target inside the goal; a milestone's `position`; empty fields `null`.
2. **Check-ins are records** (#33). A milestone has no `checkedInOn`; its `result` is read from its latest check-in, hit or not yet (decision 5). The goal's page shows `latest` and `progress` from the page read. Keep, move or adjust after "not yet" leaves the history alone.
3. **One client function per API operation**, the same in mock and real: `createGoal`, `endGoal`, `markGoalReached`, `pauseGoal`, `resumeGoal`, `reopenGoal`, `goAgain`, `setWeeklyTarget`, `addMilestone`, `updateMilestone`, `keepMilestone`, `checkIn`. Each milestone and check-in write returns the goal's page, so `useGoal` shows the response instead of reloading. A hit on the goal's own line marks the goal reached on the server (and in the mock), so the hook no longer makes a second call.
4. **The tab and an aspiration's page read goals from `listGoals`**, with each goal's `progress` (decision 1). Counts like "2 of 5" come from it, not from milestone rows.
5. **The Add sheet's goal form creates goals on the API** with a device-made id and, for a building goal, its count target.

### Accepted in real mode until later issues

- **This week's bars, recurring items and Keep life running stay empty.** They need tasks and recurring items (#42).
- **A one-off goal has no steps.** The API refuses milestones on a one-off goal, because steps are tasks (#31, after the API's `tasks-week`). Adding a step shows the usual failed-save message.
- **A new building goal gets no bank tasks.** The mock's stand-in (shared decision 12) stays mock-only.
- **`slipped` arrives but shows nothing.** The "This one slipped" card is #36.
- **The Add sheet's Task and Recurring forms can't save under a goal or aspiration.** Their pickers list the API's goals and aspirations, but tasks and recurring items are still saved by the mock, which doesn't know those ids. The save shows the usual failed-save message; with None picked it works (#42).

## Scope

**In:**

- `src/api/`: the generated types for goals, targets, milestones and check-ins; the real goal and milestone functions beside the aspiration ones; the mock reshaped to the same types and rules (check-ins kept as rows; only Next can be checked in; moving a date later pushes later dated milestones out, capped at the deadline).
- `domain/aspirations.ts`, `domain/aspiration.ts` and `domain/goalDetail.ts` read the new shapes. Counts come from `progress`, latest from `latest`, a target's number from `sessions`.
- `hooks/useGoal.ts` and `hooks/useAdd.ts` call the new functions.
- Types regenerated after the API change in decisions 1, 4 and 5.
- `CLAUDE.md` (which types are generated) and `../docs/` wherever a described behaviour moves.

**Out (later):**

- Amount targets in the form, the sheet and pacing (#32).
- One-off steps as tasks (#31), the slipped card (#36), deleting mistakes (#38).
- Editing a goal (`updateGoal`) and reordering milestones (`reorderMilestones`): the API has both, and no screen does them yet.
- Today, Week, the bank, recurring items (#42); the stored plan and offline queue (#43).

## Testing strategy

- **Real functions:** each sends the right method, path and body against a stubbed `fetch`, as `realAspirations.test.ts` does.
- **Mock rules:** check-in history kept; only Next can be checked in; a hit on the goal's line reaches the goal; keep, move and adjust return the milestone to upcoming; a later date pushes later dated milestones out.
- **Domain and screens:** existing tests updated to the new shapes. Each change to a test names the shape or signature that caused it. Nothing on screen should differ on mock.
- **Type check:** `npm run build` fails if the mock stops matching the generated types.
- **Manual, recorded in the PR:** on a local API (`npm run dev:real`), every action on the three screens and adding a goal: pause, resume, end, reached, reopen, go again, set the target, add a milestone, check in hit and not yet, keep, move, adjust. Each change should still be there after a reload. Then turn the API off and check that failed saves are reported as they are today.

## Boundaries

- **Always:** screens call `api/` functions only; mock is the default; test, lint and build before each commit.
- **Ask first:** any new dependency; any further API change beyond decisions 1, 4 and 5; reaching into #32's or #31's UI.
- **Never:** hand-write or edit an API type; call `fetch` outside `api/request.ts`; map field names by hand.

## Success criteria

- [x] Every acceptance criterion on #41, and on #33, is met.
- [x] The three screens and the goal form work fully on the real API with the switch on, and on mock with it off, looking as they do now.
- [x] No hand-written goal, target or milestone type is left in `types.ts`.
- [x] `npm test`, `npm run lint`, `npm run build` pass.

## Settled with Jan, 2026-11-18

1. **The API adds `progress` to each goal in `listGoals`** (`{ hit, of }`, as on the goal's page), so the tab and an aspiration's page get their counts in one read (the API's decision 11). This is a small API change, made before the front end wiring.
2. **#33 is taken in whole, #32 as data shape only.** Targets are count targets in the UI; `kind` is always `count` from the form.
3. **Client functions follow the API one for one**, in mock and real. Hooks change; screens shouldn't.
4. **The goal's page read names its aspiration.** The same API change adds `aspiration: { id, name } | null` to the goal page, for "Be fit ›" and "What's next for Be fit?".
5. **Each milestone on the goal page carries `result`:** the result of its latest check-in, hit or not yet, or `null` while it's upcoming. The timeline keeps showing "Hit · Bench 150" and "Not yet · Bench 152", and the not-yet card "Now: bench 152." (API #26, widened to not-yet check-ins in API #30 on 2026-11-18.)

## Assumed

6. **The tab's bars use the target in force this week**, but `goal.weeklyTarget` is the latest one, which can start next week once next week is open (ADR-009). *Assumed:* until #42 the bars are empty in real mode, so this is settled there.

## Checked, 2026-11-18

In a desktop browser at phone width, against a local API (`npm run dev:real`, Chrome DevTools), on a new building goal under an aspiration: add the goal with a target, change the target (15 can't be saved), add two milestones, check in not yet, keep, move (the API pushes the later dated milestone by the same weeks), adjust, check in hit, pause and resume, end and go again, reached and reopen, then not yet and hit on the goal's own line. Each reached the API at its own route and stayed after a reload. The tab and the aspiration's page list the goal with its count. With the API off, Reopen and a new goal from the Add sheet show "Couldn't save that. Try again." and keep what was shown or typed, and the tab shows its load message; the target and add-milestone rollbacks are covered by `useGoal`'s tests, since the goal was reached and couldn't be reopened offline.

On the phone (Jan, `dev:real`): the same screens and the buttons at the foot of a goal's page work as tapped.
