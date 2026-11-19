# Tasks: Tasks as the API has them (#30), Next week and wrap-up (#46), "Still matter?" (#35)

Plan: [`plan.md`](plan.md). Issues: #30, #46, #35.

Every task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

Test dates are fixed to Wednesday 11 Nov 2026, or to a Sunday evening where a test says so.

# PR: `tasks-as-api` (closes #30)

### Task 1: Read task state through one module

**Description:** `domain/tasks.ts`: `isOnDay(task, day?)`, `isInBank`, `isDone`, `isPlanned`, `weekOf`, and the writers `placedOnDay`, `checkedOff`, `uncheckedOff` (`isSetAside` and `timesCarriedOver` have no reader outside the client and mock, so they wait for task 2), over today's `Task`. Every reader in `domain/`, `hooks/`, `components/` and `api/client.ts` switches to them. Nothing else changes.

**Acceptance criteria:**
- [x] Outside `domain/tasks.ts`, `client.ts` and `mockData.ts`, nothing reads `status`, `weekOf` or `rolloverCount` (a grep in the task's notes: only the Add form's `Placement` and `WeekPlan.weekOf` remain, neither a task's).
- [x] Each helper has tests, set-aside tasks included.
- [x] Every existing test passes unchanged.

**Verification:** `npm test && npm run lint && npm run build`.

**Dependencies:** None

**Files:** `src/domain/tasks.ts`, `src/domain/tasks.test.ts`, `src/domain/{week,today,upkeep,aspiration,aspirations,add}.ts`, `src/hooks/useWeek.ts`

**Scope:** M

### Task 2: Use the generated Task everywhere

**Description:** `types.ts` names `Task` from `openapi.ts`. `mockData.ts` stores `StoredTask` (the `Task` plus `setAside`) and the client returns the API's shape. `domain/tasks.ts` reads the new fields. Pausing a goal, ending it or turning an item off sets its tasks aside; resuming returns them to this week's bank. A new goal's stand-in sessions are `origin: 'weeklyTarget'`.

**Acceptance criteria:**
- [x] `TaskStatus`, `weekOf` and `rolloverCount` are gone from the task type, and "skipped" is "set aside" everywhere in code.
- [x] Today, Week, the bank, Upkeep and the aspiration pages show what they did before.
- [x] Mock data and tests updated; the pause and resume tests pass with only the field names changed.

**Verification:** `npm test && npm run lint && npm run build`.

**Dependencies:** 1

**Files:** `src/api/{types,mockData,client}.ts`, `src/api/{mockData,client}.test.ts`, `src/domain/tasks.ts`, `src/domain/tasks.test.ts`

**Scope:** M

### Task 3: Plan functions take the API's names and the week

**Description:** `skipTask` becomes `moveTaskToBank(taskId, week)`, `pullFromBank` becomes `placeTask(taskId, week, day)`, and `swapTask` becomes `swapTasks(taskId, { week, bankTaskId, day })`, returning `{ toBank, placed }`. A plan edit made in a week the task has left is refused, as the API's 409. The hooks and their callers follow.

**Acceptance criteria:**
- [ ] The client's plan functions have the API's operation names and bodies.
- [ ] A move sent with the wrong week is refused and changes nothing.
- [ ] Today, a day opened from Week and the bank behave as before.

**Verification:** `npm test && npm run lint && npm run build`.

**Dependencies:** 2

**Files:** `src/api/client.ts`, `src/api/client.test.ts`, `src/hooks/{useDay,useWeek,planUpdates}.ts`, `src/hooks/useDay.test.tsx`

**Scope:** M

## Checkpoint: #30
- [ ] Build, lint and tests pass.
- [ ] Today, Week and the bank look as they did at iPhone width.
- [ ] PR opened; Jan reviews.

# PR: `next-week` (closes #46 and #35), after the API's `week-turnover` is merged

### Task 4: New types, and a mock that opens next week

**Description:** `npm run api:types`. The mock fills `atClose` and `stillMatters`. `getWeek(week)` returns `isCurrent` and `nextWeekOpen`. From 6 p.m. on Sunday (device clock) the mock has next week open, with some tasks of its own. The mock's `wrapUpWeek` applies `atClose`. `answerStillMatters` is added to the client.

**Acceptance criteria:**
- [ ] Before 6 p.m. on Sunday, next week isn't open; from then it is, and its tasks can't be checked off.
- [ ] After `wrapUpWeek`, "carriesOver" tasks are in next week's bank, "ends" tasks are closed, and next week is current.
- [ ] Keep, schedule and drop change the task as the API does; mock data includes a task marked `stillMatters`.

**Verification:** `npm test && npm run lint && npm run build`.

**Dependencies:** 3, and API #9 merged

**Files:** `src/api/{openapi,types,client,mockData}.ts`, `src/api/{client,mockData}.test.ts`

**Scope:** M

### Task 5: Next week on the Week screen

**Description:** Once next week is open, Week shows a "This week | Next week" toggle. Next week shows its days, Monday to Sunday, and its bank. A task can be put on a day, sent back to the bank or swapped, but not checked off. The chosen view is remembered across reloads.

**Acceptance criteria:**
- [ ] Before 6 p.m. on Sunday, and on every other day, Week reads as it does now, with no toggle.
- [ ] On Next week, place, back to bank and swap work, and no check-off is offered.
- [ ] After a reload, the same view is open; with next week no longer open, it falls back to This week.

**Verification:** `npx vitest run src/screens/Week.test.tsx src/hooks`; build, lint.

**Dependencies:** 4

**Files:** `src/screens/Week.tsx`, `src/screens/Week.css`, `src/screens/Week.test.tsx`, `src/hooks/useWeek.ts`, `src/storage/weekView.ts`

**Scope:** M

### Task 6: Wrap up this week

**Description:** **Wrap up this week** sits on Next week. A sheet lists what carries over and what ends with the week, from `atClose`, then confirms. After confirming, Week shows the new current week. Nothing prompts it.

**Acceptance criteria:**
- [ ] The sheet's two lists match the tasks' `atClose`; an empty list isn't shown. The wording is warm and never mentions misses.
- [ ] Confirming calls `wrapUpWeek`; afterwards next week's tasks can be checked off and the toggle is gone. There's no undo.
- [ ] A failed wrap-up leaves the week as it was and says so in one line.

**Verification:** `npx vitest run src/components/WrapUpSheet.test.tsx src/screens/Week.test.tsx`; build, lint.

**Dependencies:** 5

**Files:** `src/components/WrapUpSheet.tsx`, `src/components/WrapUpSheet.test.tsx`, `src/screens/Week.tsx`, `src/hooks/useWeek.ts`

**Scope:** M

## Checkpoint: Next week
- [ ] Next week and wrap-up click through on mock data.

### Task 7: The "Still matter?" card

**Description:** Each task marked `stillMatters` shows a card at the top of Today: "Still matter?", with the task's title, and **Keep**, **Reschedule** (the day picker) and **Drop**. Each answer goes through `answerStillMatters`, and the card goes away. Ignoring it changes nothing.

**Acceptance criteria:**
- [ ] The card shows only for marked tasks, and only on Today.
- [ ] Keep, Reschedule and Drop each send their answer; a failed one puts the card back and says so.
- [ ] No shame language: no "missed", "overdue" or counts of weeks.

**Verification:** `npx vitest run src/components/StillMattersCard.test.tsx src/screens/Day.test.tsx`; build, lint.

**Dependencies:** 4

**Files:** `src/components/StillMattersCard.tsx`, `src/components/StillMattersCard.test.tsx`, `src/screens/Day.tsx`, `src/hooks/useDay.ts`

**Scope:** M

### Task 8: Docs and the phone check

**Description:** `../docs/screens/README.md` describes Next week, the wrap-up sheet and the card. `specs/README.md` notes #30, #46 and #35 as done. The screens are checked at iPhone width by a Sonnet agent with the browser.

**Acceptance criteria:**
- [ ] The docs say what was built.
- [ ] Next week, the wrap-up sheet and the card read well at iPhone width, light and dark.

**Verification:** the phone check's notes in the PR.

**Dependencies:** 5–7

**Files:** `../docs/screens/README.md`, `specs/README.md`

**Scope:** S

## Checkpoint: the PR
- [ ] Build, lint and tests pass; the issues' acceptance criteria are met.
- [ ] PR opened; Jan reviews.
