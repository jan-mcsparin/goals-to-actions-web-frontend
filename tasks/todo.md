# Tasks: Today screen (#2)

Plan: [`plan.md`](plan.md). Spec: [`../specs/002-today-screen.md`](../specs/002-today-screen.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit.

## Phase 1: Foundation

### Task 1: Component test tooling

**Description:** Add React Testing Library and jsdom, configure Vitest so `*.test.tsx` runs in jsdom and `*.test.ts` stays in Node, and prove it with a smoke test of `App`.

**Acceptance criteria:**
- [x] Dev deps added at pinned current versions: `@testing-library/react`, `@testing-library/dom` (its required peer), `@testing-library/user-event`, `jsdom` 31 (needs Node ≥ 22.22.2). `dom` peer approved 2026-11-09.
- [x] `src/App.test.tsx` renders `App` and finds the app name; existing Node tests are unaffected.
- [x] Setup cleans up between tests (RTL `cleanup`, or `globals` as the docs say).

**Verification:**
- [x] `npm test` runs both environments green
- [x] `npm run build` type-checks the `.tsx` test

**Dependencies:** None

**Files:** `package.json`, `package-lock.json`, `vite.config.ts`, `src/test/setup.ts`, `src/App.test.tsx`

**Scope:** S (config)

### Task 2: `domain/today.ts`: groups, order, labels, progress

**Description:** Pure functions that turn a `TodayPlan` into what the screen renders, for both views.

**Acceptance criteria:**
- [x] `groupForList(plan)` returns Keep life running (recurring and unattached tasks), Move forward (goal tasks); within each, timed tasks by time, then untimed in plan order. `groupByGoal(plan)` returns Keep life running, then one section per goal titled "Goal · Aspiration", ordered by aspiration priority. Skipped tasks are excluded.
- [x] `timeLabel` gives "by 7 a.m.", "at 6 p.m.", "at 6:30 p.m.", "at 12 p.m.", "at 12 a.m."; `goalSubline` gives "Be strong · Be fit" or the goal alone.
- [x] `progress(plan)` returns `{ done, total }` over planned + done; `dayHeading(date)` gives "Today · Wednesday" from a local day string, correct at 11:30 p.m.

**Verification:**
- [x] `npm test`: `domain/today.test.ts` covers each bullet, using hand-built plans (no mock store)

**Dependencies:** None

**Files:** `src/domain/today.ts`, `src/domain/today.test.ts`

**Scope:** S (2 files, most of the logic)

## Checkpoint: Foundation
- [x] Tests, lint and build pass

## Phase 2: Core

### Task 3: Today renders the plan (List view, read-only)

**Description:** `useToday` loads the plan; `Today` shows the heading, "N of M done", the progress bar, the List groups with time labels and sublines, the Free time line "The rest is yours", a Pull from bank button (inert for now), and the empty-day state. `App` renders `Today`.

**Acceptance criteria:**
- [x] With the mock store on Wednesday, the screen shows both groups with the right tasks in the right order and "0 of 4 done".
- [x] No tasks today → a warm line and the Pull from bank button; no progress bar.
- [x] Components hold no grouping or formatting logic (they call `domain/`).

**Verification:**
- [x] `npm test`: `screens/Today.test.tsx` covers both bullets
- [ ] Manual: `npm run dev`, looks right at 390 px

**Dependencies:** Tasks 1, 2

**Files:** `src/hooks/useToday.ts`, `src/screens/Today.tsx`, `src/components/TaskRow.tsx`, `src/screens/Today.css`, `src/App.tsx`, `src/screens/Today.test.tsx`

**Scope:** M (6 files, mostly small)

### Task 4: One-tap check-off with undo (optimistic)

**Description:** Add `uncheckTask` to the client. `useToday.toggleDone` updates state immediately, then calls `checkOffTask` / `uncheckTask`; on rejection it restores the task and shows "Couldn't save that. Try again."

**Acceptance criteria:**
- [x] `uncheckTask` sets status `planned`, clears `completedAt` and `valueLogged`; unknown ID or a task that isn't done rejects.
- [x] Tapping a row marks it done before the client resolves and updates "N of M done"; tapping again undoes it. On rejection the row reverts and the message shows.
- [x] Two quick taps settle on the second tap's state. The row is a checkbox (`role="checkbox"`, `aria-checked`, named by the title); done isn't shown by colour alone.

**Verification:**
- [x] `npm test`: client tests for `uncheckTask`; `hooks/useToday.test.tsx` with a deferred client mock for optimistic, rollback and double-tap; screen test for tap → count

**Dependencies:** Task 3

**Files:** `src/api/client.ts`, `src/api/client.test.ts`, `src/hooks/useToday.ts`, `src/hooks/useToday.test.tsx`, `src/components/TaskRow.tsx`, `src/screens/Today.test.tsx`

**Scope:** M

## Checkpoint A
- [x] Tests, lint and build pass
- [ ] Review with Jan on the phone (`npm run dev -- --host`): read and check off

## Phase 3: Views and bank

### Task 5: Bank API: `getBank`, `skipTask`, `swapTask`, `pullFromBank`

**Description:** The client functions from the spec's API additions, against the mock store.

**Acceptance criteria:**
- [x] `getBank` returns this week's `inBank` tasks plus the goals, aspirations and recurring items they reference as a `Bank` shape like `TodayPlan`, in `types.ts`.
- [x] `skipTask` → `inBank`, `plannedDay` cleared, `rolloverCount` unchanged; `pullFromBank` → `planned` today; both reject unknown or wrong-status IDs.
- [x] `swapTask` does both or neither: an invalid ID on either side leaves the store unchanged. Each task keeps its own `timeOfDay`.

**Verification:**
- [x] `npm test`: one test per bullet, plus visibility in the next `getToday` / `getBank` and copies returned

**Dependencies:** None (can run in parallel with Tasks 1–4)

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S–M

### Task 6: By goal view and remembered toggle

**Description:** `storage/viewPreference.ts` reads and writes `'list' | 'byGoal'`. `useToday` exposes `view` / `setView`; a segmented `ViewToggle` switches between List and By goal (cards from `groupByGoal`, Free time line below).

**Acceptance criteria:**
- [ ] Default is List; the chosen view persists across a remount; storage that throws falls back to List without crashing.
- [ ] By goal shows Keep life running, then "Be strong · Be fit" with its tasks.
- [ ] The toggle is two buttons with `aria-pressed`, each at least 44 px tall.

**Verification:**
- [ ] `npm test`: `storage/viewPreference.test.ts`; screen test toggles, unmounts, remounts, sees By goal

**Dependencies:** Tasks 2, 3

**Files:** `src/storage/viewPreference.ts`, `src/storage/viewPreference.test.ts`, `src/components/ViewToggle.tsx`, `src/hooks/useToday.ts`, `src/screens/Today.tsx`, `src/screens/Today.test.tsx`

**Scope:** M

### Task 7: Pull from bank

**Description:** The Pull from bank button opens `BankSheet`, which lists bank tasks with their sublines; picking one calls `useToday.pull`, which adds it to today optimistically and closes the sheet.

**Acceptance criteria:**
- [ ] The sheet lists the mock bank (deadlift day, garage shelves, call the dentist); picking one adds it to the right group and updates "N of M".
- [ ] Empty bank → "Nothing in the bank." Rejection reverts and shows the calm message.
- [ ] The sheet is a dialog: focus moves in, Escape and a Close button close it, focus returns to the button.

**Verification:**
- [ ] `npm test`: screen test for pick → row appears; hook test for rollback

**Dependencies:** Tasks 4, 5

**Files:** `src/components/BankSheet.tsx`, `src/hooks/useToday.ts`, `src/screens/Today.tsx`, `src/screens/Today.test.tsx`, `src/screens/Today.css`

**Scope:** M

### Task 8: Skip and Swap from the ⋯ menu

**Description:** Each planned row gets a "⋯" button (labelled "More for <title>") with Skip and Swap. Skip sends the task to the bank; Swap opens `BankSheet` and replaces the task with the picked one. Both go through `useToday`, optimistically.

**Acceptance criteria:**
- [ ] Skip removes the row and lowers the total in "N of M"; the task shows up in the bank sheet.
- [ ] Swap moves the picked task onto today and the swapped-out task into the bank; each keeps its own time, and "N of M" is unchanged.
- [ ] Done rows have no ⋯ menu (undo is the tap). Rejection reverts both tasks and shows the calm message.

**Verification:**
- [ ] `npm test`: screen tests for skip and swap; hook test for swap rollback

**Dependencies:** Task 7

**Files:** `src/components/TaskMenu.tsx`, `src/components/TaskRow.tsx`, `src/hooks/useToday.ts`, `src/screens/Today.test.tsx`, `src/hooks/useToday.test.tsx`

**Scope:** M

## Checkpoint B
- [ ] Every success criterion in the spec is met
- [ ] Tests, lint and build pass
- [ ] Manual at 375 and 390 px: no horizontal scroll, tap targets ≥ 44 px, safe areas respected, light and dark

## Phase 4: Wrap-up

### Task 9: Docs

**Description:** Record the behavior settled in the spec. Parent-repo edits go on their own branch and PR.

**Acceptance criteria:**
- [ ] `../docs/screens/README.md` (Today): Free time reads "The rest is yours"; unattached tasks sit under Keep life running; By goal cards are "Goal · Aspiration"; skip and swap via a ⋯ menu; tap again to undo.
- [ ] `../docs/flows.md` Flow 5 mentions undo by tapping again.
- [ ] `web-frontend/CLAUDE.md` `storage/` line mentions the view preference in `localStorage` until #8.

**Verification:**
- [ ] Manual read-through against the spec's Decisions

**Dependencies:** None (can run any time after the spec)

**Files:** `../docs/screens/README.md`, `../docs/flows.md`, `CLAUDE.md`

**Scope:** S

## Checkpoint C
- [ ] Web-frontend PR open, referencing #2; parent-repo PR open, referencing #2
