# Tasks: Today, Week and the bank on the API (#42)

Plan: [`plan.md`](plan.md). Spec: [`../specs/042-plan-screens-on-api.md`](../specs/042-plan-screens-on-api.md). Issue: #42.

Every front-end task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

### Task 0 (API repo): The week read names aspirations and fixed days

**Description:** API #45. Each task gains `aspiration` (`{ id, name, position } | null`, from its goal; `position` null when retired) and `fixedDay` (from a weekly or monthly recurring item); each `WeekGoal` gains `aspiration`. Added to every query that builds a task (`GetTaskView`, `ListWeekTasks`, `ListSteps`, the upcoming list), so every task response has the same shape. Its own branch and PR in `api/`.

**Acceptance criteria:**
- [x] The week read, the upcoming list and every task write return both fields.
- [x] A task with no goal, or a goal with no aspiration, has `aspiration: null`; a retired aspiration has `position: null`.
- [x] Additive only: `test_repeats.py` and `test_queued_writes.py` still pass unchanged.
- [x] `openapi.json` regenerated; ruff, mypy and pytest pass.

**Files:** `db/queries/tasks.sql`, `app/db/` (sqlc), `app/tasks/models.py`, `app/tasks/week.py`, `tests/`, `openapi.json`

**Dependencies:** None · **Scope:** M · Done: API PR #46

### Task 1: Tasks carry their aspiration and fixed day

**Description:** `npm run api:types`. The mock works out `aspiration` and `fixedDay` when it sends a task (in `taskOut`, as it does `atClose`); like `atClose`, they're stored empty, so `mockData.ts`'s rows don't change. The `aTask` fixture gains both, `null` and `false`.

**Acceptance criteria:**
- [x] A goal's task names its goal's aspiration with its position; a loose task and a goal with none have `null`; a retired aspiration has `position: null`.
- [x] A weekly or monthly recurring item's task is `fixedDay`; a flexible one's isn't.
- [x] Nothing on screen changes.

**Files:** `src/api/openapi.ts` (generated), `src/api/mockData.ts`, `src/api/client.ts` (+ test), `src/test/tasks.ts`

**Dependencies:** Task 0 · **Scope:** S

### Task 2: The mock sends the API's `Week`

**Description:** `WeekPlan` becomes the generated `Week`: `week` (not `weekOf`), `days`, `goals` as `WeekGoal` with `progress`, `quittingGoals` (empty in the mock). The mock's `getWeek` builds it, counting progress as the API does. `domain/week.ts` reads it: progress rows from `goals`, titled and ordered by each goal's `aspiration`. `useWeek` follows. The tests that build or read a week move to the new names; what they assert doesn't change.

**Acceptance criteria:**
- [x] `WeekPlan` is gone from `types.ts`; `Week` and `WeekGoal` are named from the schema.
- [x] Week looks as before on mock: same rows, order, pacing lines, day lines, wrap-up lists.

**Files:** `src/api/types.ts`, `src/api/client.ts` (+ test), `src/domain/week.ts` (+ test), `src/hooks/useWeek.ts`; fixtures only in `src/api/nextWeek.test.ts`, `src/hooks/dataRevision.test.tsx`

**Dependencies:** Task 1 · **Scope:** M

### Task 3: Today's sections drawn from a week

**Description:** `dayOf(week, date)` and `bankOf(week)` in `domain/today.ts`. Grouping, sublines and priority read each task's `aspiration`; `fixed` reads `fixedDay`. `groupForList`, `groupByGoal`, `progress` and `bankRows` take what `dayOf` and `bankOf` give. Nothing calls them from a hook yet beyond what `useDay` already does with its shapes.

**Acceptance criteria:**
- [x] `dayOf` gives the day's tasks in day order and the week's "Still matter?" tasks; `bankOf` the week's unplaced, unfinished tasks.
- [x] Goal cards keep their aspiration's priority order, goals with none (or a retired one) last.
- [x] A fixed-day task has no menu; others do.

**Files:** `src/domain/today.ts` (+ test); `bankRows` takes the tasks in `src/hooks/useDay.ts`; the mock sends `goalLabel` (it was always empty), in `src/api/client.ts`

**Dependencies:** Task 2 · **Scope:** S

### Task 4: `useDay` reads the week

**Description:** `useDay` reads the day's week (`getWeek(mondayOfDay(date))`) and draws the day, the cards and the bank from it with `dayOf` and `bankOf`. `loadBank` no longer fetches; the bank sheet is the same week's bank. A change is shown on the week, so the day and the bank stay in step.

**Acceptance criteria:**
- [x] Today, an opened day and the bank sheet look and behave as before on mock.
- [x] `useDay`'s save and rollback tests pass with only their fixtures and stubs changed.

**Files:** `src/hooks/useDay.ts` (+ test), `src/screens/Day.tsx` (+ test; the bank sheet's own load and its loading and failure states went, since it has none), `src/hooks/dataRevision.test.tsx`

**Dependencies:** Task 3 · **Scope:** M

### Task 5: `getDay` and `getBank` go

**Description:** With nothing calling them, `getDay`, `getBank`, `DayPlan` and `Bank` go. Tests that read a day or the bank through them read the week instead.

**Acceptance criteria:**
- [x] No `getDay`, `getBank`, `DayPlan` or `Bank` type left in `src/`.
- [x] The tests that used them still check the same thing, through `getWeek`.

**Files:** `src/api/client.ts` (+ test), `src/api/types.ts`; `src/test/plan.ts` (`readDay`, `readBank`: through `getWeek`, as screens draw them); reads only in `src/api/nextWeek.test.ts`, `src/components/AddSheet.test.tsx`, `src/hooks/useAdd.test.tsx`, `src/hooks/dataRevision.test.tsx`

**Dependencies:** Task 4 · **Scope:** M (mechanical)

### Checkpoint A

- [x] Build, lint and tests pass.
- [x] Sonnet agent, mock (`npm run dev`), phone width: Today in both views, another day, Week this week and next, the bank sheet's pull and swap, back to bank, check off and uncheck, wrap-up, "Still matter?". Nothing differs from `main`.

### Task 6: Plan actions on the real API

**Description:** `api/realPlan.ts`: `getWeek` with no week reads the phone's week, or the week after once it was wrapped up early; `getWeek`, `checkOffTask`, `uncheckTask`, `moveTaskToBank`, `placeTask`, `swapTasks`, `answerStillMatters`, `wrapUpWeek`, each sending its week where the API asks. `client.ts` sends them to real behind the switch.

**Acceptance criteria:**
- [x] Each sends the right method, path and body against a stubbed `fetch`.
- [x] A 404 on `getWeek` reaches the screen as "not found", as the mock's does.
- [x] Mock unchanged.

**Files:** `src/api/realPlan.ts` (+ test), `src/api/client.ts`

**Dependencies:** Task 5 · **Scope:** S

### Task 7: Adding a task sends a day

**Description:** `NewTask` becomes the generated type. `taskInput` sends today as `day` for "On today", nothing for the bank. `taskWeek` leaves `domain/add.ts`; the mock keeps its own copy of the rule (spec decision 2). `taskConfirmation` reads the returned task, with "Saved. It joins the week it's due." when it has no week. `addTask` goes to real behind the switch.

**Acceptance criteria:**
- [x] No `taskWeek` in `domain/`.
- [x] The three confirmations, plus the new one for a task with no week, are tested.
- [x] `realPlan.addTask` sends `PUT /tasks/{id}` with a device-made id.

**Files:** `src/api/types.ts`, `src/domain/add.ts` (+ test), `src/api/client.ts`, `src/api/realPlan.ts` (+ test), `src/hooks/useAdd.ts`; `onToday` → `day` in `src/hooks/useDay.test.tsx` and `src/api/client.test.ts`

**Dependencies:** Task 6 · **Scope:** M

### Task 8: Recurring items and Keep life running on the real API

**Description:** `realPlan.ts` gains `listRecurringItems`, `createRecurringItem` (device-made id) and `getUpcoming`. Real `getUpkeep` reads the recurring items, the open weeks and the upcoming list, and keeps the loose ones. Real `getAspirations` and `getAspiration` read recurring items too. `whereLabel` says something true for a task with no week.

**Acceptance criteria:**
- [ ] Each real function tested against a stubbed `fetch`; real `getUpkeep` reads next week only when it's open.
- [ ] `whereLabel` for a task with no week is tested.
- [ ] The Add sheet's Recurring form saves under an aspiration on real.

**Files:** `src/api/realPlan.ts` (+ test), `src/api/realAspirations.ts` (+ test), `src/api/client.ts`, `src/domain/upkeep.ts` (+ test)

**Dependencies:** Task 5 · **Scope:** M

### Task 9: The tab's bars from the week's goals

**Description:** `AspirationsOverview` and `AspirationDetail` carry the current week's `goals` instead of `weekTasks`. `weekCount` and the aspiration page's bars read `progress` and the week's `weeklyTarget`. The mock builds them the same way; real reads `getWeek` alongside the rest. `NOTHING_ELSE` goes.

**Acceptance criteria:**
- [ ] Bars look as before on mock.
- [ ] The bar uses the target in force this week, not a newer one for next week.
- [ ] No `weekTasks` left.

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/realAspirations.ts` (+ test), `src/domain/aspirations.ts` (+ test), `src/domain/aspiration.ts` (+ test); fixtures in `src/screens/Aspirations.test.tsx` and `src/api/client.test.ts`

**Dependencies:** Task 2 · **Scope:** M (split the mock and real halves if it runs long)

### Task 10: Docs, checks and the PR

**Description:** `CLAUDE.md`: `realPlan.ts`; the generated types list; `domain/` described without planning or rollover rules (the server's, ADR-008). `../docs/` wherever a described behaviour moved (a separate docs-repo PR if so). Then the checks, recorded in the spec's Checked section.

**Acceptance criteria:**
- [ ] Sonnet agent, real (`npm run dev:real`, Jan's API), phone width: the spec's manual list. Each change still there after a reload; with the API off, each action shows "Couldn't save that. Try again." and puts back what was shown.
- [ ] Sonnet agent, mock: Checkpoint A's list again.
- [ ] Build, lint and tests pass.
- [ ] PR opened, closing #42; specs README moves 042 to Done.

**Files:** `CLAUDE.md`, `specs/042-plan-screens-on-api.md`, `specs/README.md`

**Dependencies:** Tasks 6 to 9 · **Scope:** S
