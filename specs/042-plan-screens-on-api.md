# Spec: Today, Week and the bank on the API (#42)

Status: approved 2026-11-20; plan in [`../tasks/plan.md`](../tasks/plan.md). Issue: [#42](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/42). Module `plan-screens-on-api` in the [map](README.md). Depends on the API's [`tasks-week`](../../api/specs/tasks-week.md), [`recurring-items`](../../api/specs/recurring-items.md), [`week-turnover`](../../api/specs/week-turnover.md) and [`planner`](../../api/specs/planner.md) slices (all built), and on a small API change: [API #45](https://github.com/jan-mcsparin/goals-to-actions-api/issues/45) (decision 1 below).

## Objective

With the switch on real, the plan is the server's (ADR-008): Today, any opened day, Week, the bank, Keep life running and the Add sheet's Task and Recurring forms read from and save to the API. The front end shows the week it's sent and sends what the person did. Mock stays the default; the click-through looks as it does now.

### What exists afterwards

1. **The week read is the only plan read** (ADR-010, API shared decision 13). `WeekPlan` becomes the generated `Week`. `getDay` and `getBank` go: a day and the bank are drawn from the week by plain functions in `domain/`, so #43 can store that one document and draw from it the same way.
2. **One client function per API operation**, the same in mock and real, in a new `api/realPlan.ts` beside `realGoals.ts`: `getWeek`, `getUpcoming`, `addTask`, `checkOffTask`, `uncheckTask`, `moveTaskToBank`, `placeTask`, `swapTasks`, `answerStillMatters`, `wrapUpWeek`, `listRecurringItems`, `createRecurringItem`. Hooks change; screens shouldn't.
3. **Adding a task sends a day, not a rule.** `NewTask` becomes the generated type: "On today" sends today as `day`; the bank sends none. The server decides the week from the due date, and the confirmation line reads the returned task (`week`, `plannedDay`).
4. **Week's progress rows read the server's progress.** Each row's done and target come from `week.goals` (`progress`, `weeklyTarget`): the target in force that week, which settles 041's assumed decision 6. Pacing ("2 days left · 1 more to plan") is still worded on the phone from that and the tasks on later days.
5. **The Aspirations tab, an aspiration's page and Keep life running fill in.** Recurring items come from `listRecurringItems`; this week's bars from the current week's `goals`; Keep life running's loose tasks from the open weeks and the upcoming list. In real mode nothing on these screens is left empty any more.
6. **"Still matter?" and wrap-up go through the API.** The cards are the week's tasks with `stillMatters`; the wrap-up sheet already reads `atClose`.
7. **Planning rules leave `domain/`**, and `CLAUDE.md` says so. `taskWeek` (where a new task goes) is the only one left there; it goes. What `domain/tasks.ts` keeps (`placedOnDay`, `inTheBank`, `checkedOff`, `uncheckedOff`) is how the screen shows a change before the answer arrives, which ADR-010 puts in `domain/` as the replay rules. The mock keeps imitating the server until #43 (decision 2).

### Accepted in real mode until later issues

- **A change shows once the API answers, and fails offline** with the usual "Couldn't save that. Try again." The stored week and the queue are #43.
- **The full-day mark isn't shown** (#70, decision 3).
- **Quitting goals' days arrive in the week read but show nothing** (#37).
- **A one-off goal still has no steps** (#31).
- **A session that ends mid-use** is handled as #48 left it; the queue's 401 handling is #43.

## Scope

**In:**

- `src/api/`: `realPlan.ts` with the functions above, each sending its week where the API asks for it; `types.ts` names the generated `Week`, `WeekGoal`, `DayMark`, `Upcoming`, `NewTask`, `RecurringItemList`; the hand-written `WeekPlan`, `DayPlan`, `Bank`, `NewTask` go. The mock builds the API's `Week` shape.
- `realAspirations.ts`: the tab and an aspiration's page read recurring items and the current week alongside aspirations and goals. `NOTHING_ELSE` goes.
- `domain/`: `dayOf(week, date)` and `bankOf(week)`; `today.ts`, `week.ts`, `upkeep.ts`, `aspirations.ts` and `aspiration.ts` read the `Week` shape; `taskWeek` goes from `add.ts`.
- `hooks/useDay.ts`, `useWeek.ts`, `useUpkeep.ts`, `useAdd.ts`: read the week, not a day and a bank.
- Types regenerated after API #45 (decision 1); Today's grouping and sublines read each task's `aspiration`, and its menu reads `fixedDay`.
- `CLAUDE.md` (generated types; planning rules are the server's) and `../docs/` wherever a described behaviour moves.

**Out (later):**

- The stored week, the offline queue, real by default (#43).
- Editing a recurring item, or turning one off or on: the API has `updateRecurringItem`, `turnOffRecurringItem` and `turnOnRecurringItem`, and no screen offers them yet.
- Editing a task (`updateTask`) and dropping one outside "Still matter?" (`dropTask`): no screen offers them yet.
- Delete (#38), quitting goals (#37), one-off steps (#31), amount targets (#32), the slipped card (#36), reports of every failed save (#17).

## Commands

```bash
nvm use                 # Node 24 (.nvmrc); the default Node 22 skips the jsdom tests
npm run api:types       # after any API change
npm test
npm run lint
npm run build           # fails if the mock stops matching the generated types
npm run dev:real        # against the local API, which Jan runs
```

## Project structure

Unchanged, plus `src/api/realPlan.ts` (+ test). `getDay` and `getBank` leave `client.ts`; `dayOf` and `bankOf` join `domain/today.ts`.

## Code style

As the rest of `src/` and spec 041: no semicolons, single quotes, 2-space indent, `.ts` imports, named exports; screens call `api/` only; only `api/request.ts` calls `fetch`. A real function looks like `realGoals.ts`:

```ts
// Onto a day of its week, placed by hand. Refused (409) once the task has left that week.
export async function placeTask(taskId: string, week: string, day: string): Promise<Task> {
  return request('POST', `/tasks/${taskId}/place`, { week, day })
}
```

## Testing strategy

- **Real functions:** each sends the right method, path, body and week against a stubbed `fetch`, as `realGoals.test.ts` does.
- **Drawing from the week:** `dayOf` and `bankOf` against a `Week` fixture: a day's tasks in day order, the bank without placed tasks, a done task kept on its day.
- **Domain and screens:** existing tests moved to the `Week` shape. Each changed test names the shape or signature that caused it. Nothing on screen should differ on mock.
- **Hooks:** `useDay` reads one week and shows its day and bank; a failed save puts the change back and shows the message, as now.
- **Manual, recorded in the PR** (by a Sonnet agent, Chrome DevTools at phone width, `npm run dev:real`): add a task to today and to the bank, with and without a due date in a later week; check off and uncheck; back to bank, pull, swap, place from Week; open another day; next week from Sunday 6 p.m. (or as the local API allows) and wrap up; answer "Still matter?" with each answer if a task is marked; add a recurring item under an aspiration and in Keep life running; check the tab's bars, an aspiration's page and Keep life running. Each change still there after a reload. Then the API off: each action shows the failed-save message and puts back what was shown.

## Boundaries

- **Always:** screens call `api/` functions only; mock is the default; `nvm use`, then test, lint and build before each commit; one commit per task; work on a branch and open a PR.
- **Ask first:** any new dependency; any API change beyond API #45; showing anything new on screen (the full-day mark, edit or turn off a recurring item).
- **Never:** hand-write or edit an API type; call `fetch` outside `api/request.ts`; work out on the phone what the server decides (which week a task goes in, what closing does, what asks "Still matter?", where recurring work goes).

## Success criteria

- [ ] Every acceptance criterion on #42 is met.
- [ ] With the switch on real, Today, any day, Week, the bank, Keep life running, the tab's bars and recurring lines, an aspiration's page and the Add sheet's Task and Recurring forms work on the API; with it off, on mock, looking as they do now.
- [ ] `getDay` and `getBank` are gone; Today and the bank are drawn from the week.
- [ ] No hand-written week, day, bank or new-task type is left in `types.ts`; `taskWeek` is gone from `domain/`.
- [ ] `npm test`, `npm run lint`, `npm run build` pass.

## Settled with Jan, 2026-11-20

1. **The week read carries what Today and Week need** ([API #45](https://github.com/jan-mcsparin/goals-to-actions-api/issues/45)). Each task, and each of the week's `goals`, names its goal's aspiration (`{ id, name, position } | null`, `position` null when retired), and each task says whether it's `fixedDay`. Today stays one read, which is what #43 stores (ADR-010, API shared decision 11). Made before the front-end wiring, as in 041.
2. **The mock keeps imitating the server until #43**: `atClose`, `stillMatters`, what wrap-up does, and shared decision 12's bank tasks for a new goal. It shrinks to what tests need when real becomes the default. None of it is in `domain/`. Shared decision 23 in the [map](README.md) is changed to say so.
3. **The full-day mark is left out** of #42 and is its own issue, [#70](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/70).
4. **A task due beyond the open weeks** is confirmed with "Saved. It joins the week it's due."
