# Tasks: Week screen (#3)

Plan: [`plan.md`](plan.md). Spec: [`../specs/003-week-screen.md`](../specs/003-week-screen.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit.

## Phase 1: Any day

### Task 1: Rename Today's plan to a day's plan

**Description:** Mechanical rename with no behaviour change: `TodayPlan` → `DayPlan`, `getToday()` → `getDay(date)`, `useToday` → `useDay(date)`, `Today.tsx` → `Day.tsx` (with a `date` prop). `App` passes today's date.

**Acceptance criteria:**
- [x] No `TodayPlan`, `getToday` or `useToday` left in `src/`; no aliases.
- [x] `getDay(date)` returns that date's tasks and what they reference (one new client test for a non-today date).
- [x] All existing tests pass with only names changed.

**Verification:**
- [x] `npm test`, `npm run build`; `grep -r "TodayPlan\|getToday\|useToday" src` is empty

**Dependencies:** None

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `src/domain/today.ts` (+ test), `src/hooks/useDay.ts` (+ test, renamed), `src/screens/Day.tsx` (+ test, renamed), `src/App.tsx`

**Scope:** M (many files, renames only)

### Task 2: Place bank tasks on a given day, and record `placedByHand`

**Description:** `pullFromBank(id, day?)` places on `day` (default today). `swapTask` places the bank task on the swapped task's day. Both set `placedByHand: true`; `skipTask` clears it. Add the field to `Task`.

**Acceptance criteria:**
- [x] `pullFromBank('task-lift-bank', '2026-11-13')` plans it for Friday with `placedByHand: true`; without a day it goes to today.
- [x] Swapping a Thursday task puts the bank task on Thursday; both sides' `placedByHand` are right.
- [x] `skipTask` removes `placedByHand`; `pullFromBank` rejects a past day ("Can't place a task on a past day").

**Verification:**
- [x] `npm test`: client tests per bullet

**Dependencies:** Task 1

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 3: The Day screen works for any date

**Description:** `useDay(date)` passes its date to pull and swap and sets `placedByHand` in its optimistic copies. `dayHeading(date, today)` gives "Today · Wednesday" or "Thursday · Nov 12". `Day` shows a "‹ Week" back button when given `onBack`.

**Acceptance criteria:**
- [x] Rendering `<Day date="2026-11-12" />` (on a Wednesday) shows Thursday's tasks under "Thursday · Nov 12".
- [x] Pull from bank and Swap on that screen place the task on Thursday; check-off and undo work there too.
- [x] "‹ Week" appears only with `onBack` and calls it.

**Verification:**
- [x] `npm test`: `domain/today.test.ts` heading cases; `hooks/useDay.test.tsx` pull onto Thursday; `screens/Day.test.tsx` heading, pull and back

**Note:** on past days Pull from bank and Swap are hidden (the API refuses past days); check-off, undo and Back to bank stay.

**Dependencies:** Task 2

**Files:** `src/domain/today.ts` (+ test), `src/hooks/useDay.ts` (+ test), `src/screens/Day.tsx` (+ test)

**Scope:** M

### Task 4: Fixed-day items have no menu

**Description:** Rows from a fixed-day recurring item are marked `fixed`, and `TaskRow` hides ⋯ for them. They can still be checked off.

**Acceptance criteria:**
- [x] `groupForList` / `groupByGoal` rows carry `fixed: true` for tasks whose recurring item has `fixedDay`.
- [x] On Tuesday, "Take out the trash" has no "More for…" button but can be checked off.

**Verification:**
- [x] `npm test`: domain test, and a screen test on a Tuesday date

**Dependencies:** Task 3

**Files:** `src/domain/today.ts` (+ test), `src/components/TaskRow.tsx`, `src/screens/Day.test.tsx`

**Scope:** S

## Checkpoint A
- [x] Tests, lint and build pass
- [x] Today behaves exactly as before; any day can be rendered and changed

## Phase 2: Navigation

### Task 5: Tab bar and remembered screen

**Description:** `storage/navigation.ts` reads and writes the current screen; `useNavigation()` exposes it with `goTo`. `TabBar` (Today | Week) sits at the bottom. `App` renders Today, a placeholder Week ("This week"), or an opened day.

**Acceptance criteria:**
- [x] Default is Today; the screen (including `{ screen: 'day', date }`) survives a remount; bad or blocked storage falls back to Today.
- [x] Tabs use `aria-current="page"`; an opened day marks Week as current; "‹ Week" returns to Week.
- [x] Content isn't hidden behind the bar (bottom padding includes the safe-area inset).

**Verification:**
- [x] `npm test`: `storage/navigation.test.ts`; `App.test.tsx` switches tabs and survives remount
- [ ] Manual: on the phone, the bar clears the home indicator

**Dependencies:** Task 3

**Files:** `src/storage/navigation.ts` (+ test), `src/hooks/useNavigation.ts`, `src/components/TabBar.tsx` (+ `.css`), `src/App.tsx`, `src/App.test.tsx`

**Scope:** M

## Checkpoint B
- [x] Tests, lint and build pass
- [ ] Review with Jan on the phone: tabs, an opened day, back

## Phase 3: Week

### Task 6: `getWeek` and a fuller mock week

**Description:** `getWeek()` returns every task with this week's `weekOf` (planned, done, in the bank), the records they reference, and active goals' weekly targets. Mock data adds tasks on Monday, Thursday, Friday and Saturday (today's tasks unchanged); hand-placed ones have `placedByHand: true`.

**Acceptance criteria:**
- [x] `getWeek()` on Wednesday includes Monday's done lift, today's tasks, the bank tasks and the Be strong target; nothing from other weeks.
- [x] The consistency test still passes; #2's screen tests keep their counts.

**Verification:**
- [x] `npm test`: client and mock-data tests

**Dependencies:** Task 1 (can run in parallel with 2–5)

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `src/api/mockData.ts`

**Scope:** M

### Task 7: `domain/week.ts`

**Description:** Pure functions for the Week screen: `weekProgress`, `pacingLine`, `daySummaries`, `weekRange`, `pickableDays`.

**Acceptance criteria:**
- [x] Pacing: "Done for the week"; "6 days left · on pace"; "6 days left · 1 more to plan"; "1 day left" on Sunday. Progress counts only that goal's done tasks.
- [x] Day summaries: Monday to Sunday, timed labels in titles ("Trash by 7 a.m."), `allDone`, "Free day" when empty, `isToday` / `isPast`.
- [x] `weekRange` gives "Nov 9–15" and "Nov 30–Dec 6"; `pickableDays` gives today and later days only.

**Verification:**
- [x] `npm test`: `domain/week.test.ts` with hand-built plans

**Dependencies:** Task 6 (types only)

**Files:** `src/domain/week.ts`, `src/domain/week.test.ts`

**Scope:** S

### Task 8: Week screen: progress and days

**Description:** `useWeek` loads the week and maps it through `domain/week.ts`. `Week` replaces the placeholder: header with range, progress rows with bars and pacing, seven day rows. Tapping a day opens it.

**Acceptance criteria:**
- [ ] On Wednesday: "Be strong · Be fit", "1 of 3", "5 days left · 1 more to plan"; seven day rows, Wednesday marked `aria-current="date"`, Monday and Tuesday dimmed.
- [ ] Tapping Thursday opens the Thursday day screen; "‹ Week" comes back.

**Verification:**
- [ ] `npm test`: `screens/Week.test.tsx`; `App.test.tsx` open-a-day round trip
- [ ] Manual: 390 px, light and dark

**Dependencies:** Tasks 5, 7

**Files:** `src/hooks/useWeek.ts`, `src/screens/Week.tsx`, `src/screens/Week.css`, `src/screens/Week.test.tsx`, `src/App.tsx`

**Scope:** M

### Task 9: Week screen: bank and "Put on a day"

**Description:** Bank chips under the days. Tapping one opens `DayPickerSheet` (native `<dialog>`) listing Today and later days; picking one calls `pullFromBank(id, day)` optimistically through `useWeek`.

**Acceptance criteria:**
- [ ] "Bank · 3 not on a day" with three chips; picking Thursday moves the task into Thursday's row and drops the count to 2.
- [ ] Past days aren't offered; empty bank reads "Nothing in the bank."
- [ ] A failed save puts the chip back and shows "Couldn't save that. Try again."

**Verification:**
- [ ] `npm test`: screen tests per bullet; hook test for rollback

**Dependencies:** Task 8

**Files:** `src/components/DayPickerSheet.tsx` (+ `.css`), `src/hooks/useWeek.ts`, `src/screens/Week.tsx`, `src/screens/Week.test.tsx`

**Scope:** M

## Checkpoint C
- [ ] Every success criterion in the spec is met
- [ ] Tests, lint and build pass
- [ ] Manual at 375 and 390 px, light and dark; tab bar and sheets on the phone

## Phase 4: Docs

### Task 10: Docs

**Description:** Record what changed, in the parent repo on its own branch, and in this repo.

**Acceptance criteria:**
- [ ] `../docs/data-model.md`: Task gains "placed by hand"; the planner never moves such tasks.
- [ ] `../docs/screens/README.md` (Week): tap a bank task, then pick a day (drag later); pacing wording; fixed-day items have no menu; tab bar.
- [ ] `CLAUDE.md` (this repo): navigation goes through `useNavigation()`; no router yet.

**Verification:**
- [ ] Manual read-through against the spec's Decisions

**Dependencies:** None (any time after the spec)

**Files:** `../docs/data-model.md`, `../docs/screens/README.md`, `CLAUDE.md`

**Scope:** S

## Checkpoint D
- [ ] Web-frontend PR open, referencing #3; parent-repo PR open, referencing #3
