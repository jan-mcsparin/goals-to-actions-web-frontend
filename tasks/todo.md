# Tasks: Aspirations tab (#4)

Plan: [`plan.md`](plan.md). Spec: [`../specs/004-aspirations-tab.md`](../specs/004-aspirations-tab.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026, as before.

## Phase 1: Data

### Task 1: The mock dataset grows

**Description:** Add `status` and `retiredAt` to `Aspiration`, and the spec's mock records: Have endurance and Look good under Be fit, two more Be strong milestones, five steps for the garage, Stretch and Hockey, a paused goal, a reached goal, a goal with no aspiration and a deadline, and a retired aspiration with a reached goal. No new client function yet.

**Acceptance criteria:**
- [x] Be strong has five milestones (one hit, one not yet, three upcoming); Have endurance has three (two hit), a target of 2 runs, one run done on Monday and one in the bank; the garage has five steps, three hit.
- [x] Every aspiration has a `status`; exactly one is retired, with `retiredAt`. The consistency tests pass with the new records.
- [x] Today's tasks are unchanged. Week shows a second progress row ("Have endurance · Be fit", "1 of 2") and four bank chips; those expectations are updated here and nowhere else changes.

**Verification:**
- [x] `npm test`: `mockData.test.ts` contents; updated `Week.test.tsx`, `client.test.ts` and the one bank count in `Day.test.tsx`
- [ ] Manual: `npm run dev`, Today looks the same, Week shows the run

**Dependencies:** None

**Files:** `src/api/types.ts`, `src/api/mockData.ts`, `src/api/mockData.test.ts`, `src/screens/Week.test.tsx`, `src/api/client.test.ts`, `src/screens/Day.test.tsx`, plus `status` on the aspiration fixtures in `src/domain/today.test.ts` and `src/domain/week.test.ts`

**Scope:** M (one data file, the rest are expectations)

### Task 2: `getAspirations`

**Description:** `getAspirations()` returns an `AspirationsOverview`: every aspiration and goal, the goals' milestones in order, active recurring items, the weekly target in force per active goal, and this week's goal tasks.

**Acceptance criteria:**
- [x] Includes active and retired aspirations, goals of every status, and milestones in each goal's order.
- [x] `weeklyTargets` has one per active goal that has one (none for paused goals); `weekTasks` has only this week's tasks with a goal.
- [x] Returns copies.

**Verification:**
- [x] `npm test`: `client.test.ts`, a `getAspirations` block per bullet

**Dependencies:** Task 1

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

## Checkpoint A
- [x] Tests, lint and build pass
- [x] Today and Week behave as before, apart from Week's new row and bank chip

## Phase 2: Navigation

### Task 3: Third tab and the new screens, remembered

**Description:** The `Screen` union gains `aspirations`, `aspiration`, `upkeep` and `goal` (with `from`). `tabOf(screen)` says which tab a screen counts as. `TabBar` shows Today | Week | Aspirations. `App` renders a bare Aspirations screen (pinned "Aspirations" heading) for now.

**Acceptance criteria:**
- [x] Each new screen round-trips through storage, `goal` with both kinds of `from`; a missing or malformed id or `from` falls back to Today.
- [x] Tapping Aspirations shows the heading, marks the tab `aria-current="page"`, and survives a remount.
- [x] `aspiration`, `goal` and `upkeep` count as the Aspirations tab.

**Verification:**
- [x] `npm test`: `storage/navigation.test.ts`, `App.test.tsx`
- [ ] Manual: three labels fit at 375 px

**Dependencies:** None (can run alongside Tasks 1–2)

**Files:** `src/storage/navigation.ts` (+ test), `src/components/TabBar.tsx` (+ `.css`), `src/hooks/useNavigation.ts`, `src/screens/Aspirations.tsx`, `src/App.tsx`, `src/App.test.tsx`

**Scope:** M

## Checkpoint B
- [ ] Tests, lint and build pass
- [ ] Review with Jan on the phone: three tabs, bar clears the home indicator

## Phase 3: The tab

### Task 4: `domain/aspirations.ts`: cards and goal rows

**Description:** Pure functions that turn an `AspirationsOverview` into cards: active aspirations in priority order, each with its active and paused goals as rows, and its recurring line.

**Acceptance criteria:**
- [x] Cards are in priority order; retired aspirations and past goals (reached, ended) are left out of cards; paused goals are in, reading "Paused".
- [x] Counts treat the goal as the final milestone: "Milestone 1 of 6", "Step 3 of 6", "0 of 1" with none, "1 of 1" once reached; a one-off goal with a deadline adds "· by Dec 15".
- [x] The recurring line reads "2 recurring: Stretch, Hockey" or "No recurring items"; a card with no goals is flagged for "No goals yet."

**Verification:**
- [x] `npm test`: `domain/aspirations.test.ts` with hand-built overviews

**Dependencies:** Task 2 (types only)

**Files:** `src/domain/aspirations.ts`, `src/domain/aspirations.test.ts`

**Scope:** S

### Task 5: `domain/aspirations.ts`: the week count, and what sits below the cards

**Description:** `weekCount` per aspiration, plus Other goals (with their past goals), the Keep life running count and the retired list.

**Acceptance criteria:**
- [x] Two goals' targets are summed (3 + 2 = 5); each goal's done tasks are capped at its own target; paused goals and amount-less goals are left out; no targets gives no count.
- [x] Other goals holds active and paused goals with no aspiration, and their reached and ended goals separately; both empty means no section.
- [x] The upkeep count is the active recurring items with no aspiration; retired aspirations are listed by name.

**Verification:**
- [x] `npm test`: `domain/aspirations.test.ts`

**Dependencies:** Task 4

**Files:** `src/domain/aspirations.ts`, `src/domain/aspirations.test.ts`

**Scope:** S

### Task 6: Aspirations screen: the cards

**Description:** `useAspirations` loads the overview and maps it through the domain. `Aspirations` renders a card per active aspiration: a card-top button (name, chevron, why), the This week bar and line, goal-row buttons, the recurring line.

**Acceptance criteria:**
- [x] Be fit shows its why, "2 of 5 this week" with a progress bar, "Be strong · Milestone 1 of 6", and "2 recurring: Stretch, Hockey"; Keep a calm home shows no why, no bar and "Step 3 of 6 · by Dec 4".
- [x] A paused goal reads "Paused". Card top and goal rows are separate buttons calling `onOpenAspiration(id)` and `onOpenGoal(id)`.
- [x] A failed load says "Couldn't load your aspirations. Try again in a moment." Nothing on the screen mentions pace or being behind.

**Verification:**
- [x] `npm test`: `screens/Aspirations.test.tsx`
- [ ] Manual: 375 and 390 px, light and dark; a long goal label wraps and the count stays put

**Dependencies:** Tasks 3, 5

**Files:** `src/hooks/useAspirations.ts`, `src/screens/Aspirations.tsx`, `src/screens/Aspirations.css`, `src/screens/Aspirations.test.tsx`, `src/components/progressBar.css` (the bar's styles, moved out of `Week.css` to share)

**Scope:** M

### Task 7: Aspirations screen: below the cards

**Description:** Other goals with "Past goals (n)" closed, the Keep life running row, "Retired (n)" closed, the footer hint, and the empty state.

**Acceptance criteria:**
- [x] Other goals lists the mock's loose goal as a goal row; its past goals sit behind a closed "Past goals (n)". The section is absent when there are none of either.
- [x] "Keep life running" always shows, with "1 recurring" and a chevron, and calls `onOpenUpkeep`. "Retired (1)" is closed at first; opened, each name calls `onOpenAspiration`.
- [x] Footer: "In order of priority. The first comes first when goals compete for time." With nothing set up: "Nothing here yet. Start with one sentence: a goal, or who you want to be."

**Verification:**
- [x] `npm test`: `screens/Aspirations.test.tsx` per bullet (empty state with a mocked empty overview)

**Dependencies:** Task 6

**Files:** `src/screens/Aspirations.tsx`, `src/screens/Aspirations.css`, `src/screens/Aspirations.test.tsx`

**Scope:** S

### Task 8: Open an aspiration or a goal

**Description:** Placeholder `Aspiration` (name, "‹ Aspirations") and `GoalDetail` (label, a back link named for where you came from) screens, wired in `App` with `from`.

**Acceptance criteria:**
- [x] Tapping Be fit's card top opens its placeholder; "‹ Aspirations" returns to the tab.
- [x] Tapping a goal row opens the goal's placeholder with `from: { screen: 'aspirations' }`; back returns there. A goal with `from` an aspiration goes back to that aspiration.
- [x] Both keep Aspirations as the current tab and survive a remount; an id that no longer exists shows only the back link.

**Verification:**
- [x] `npm test`: `App.test.tsx`
- [ ] Manual on the phone: card top and goal rows are easy to hit apart

**Dependencies:** Task 7

**Files:** `src/screens/Aspiration.tsx`, `src/screens/GoalDetail.tsx`, `src/components/BackLink.tsx` (+ `.css`), `src/App.tsx`, `src/App.test.tsx`

**Scope:** M

## Checkpoint C
- [ ] Tests, lint and build pass
- [ ] Review with Jan: the tab at 375 and 390 px, light and dark; open and back for an aspiration and a goal; reload restores

## Phase 4: Keep life running

### Task 9: `getUpkeep` and `domain/upkeep.ts`

**Description:** `getUpkeep()` returns active recurring items with no aspiration and not-done tasks with no goal and no recurring item, from this week on. `domain/upkeep.ts` turns them into recurring rows and to-do rows that say where each task sits.

**Acceptance criteria:**
- [x] `getUpkeep()` leaves out goal tasks, recurring tasks, done tasks and items under an aspiration; returns copies.
- [x] Recurring rows carry name and repeat rule. To-do rows read "Today", "Thursday", "In the bank" or "Week of Nov 23", plus "due Nov 13" when there's a due date.
- [x] Empty lists give "No recurring items." and "Nothing waiting."

**Verification:**
- [x] `npm test`: `client.test.ts` `getUpkeep` block; `domain/upkeep.test.ts` with hand-built data (the later-week case lives here)

**Dependencies:** Task 1 (can run alongside Tasks 3–8)

**Files:** `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `src/domain/upkeep.ts`, `src/domain/upkeep.test.ts`

**Scope:** M

### Task 10: Keep life running page

**Description:** `useUpkeep` and the `Upkeep` screen: pinned "‹ Aspirations" and "Keep life running" with its one line, then Recurring and To do. Wired in `App` from the tab's row.

**Acceptance criteria:**
- [x] Shows "The things that have to happen, under no goal.", "Pay rent · Monthly on the 1st", and the mock's loose tasks, including "Fill out my ballot" with "Today · due Nov 13".
- [x] The only control on the page is back. No checkboxes, no menus.
- [x] Opening it from the tab, going back, and a remount all work; the tab stays Aspirations.

**Verification:**
- [x] `npm test`: `screens/Upkeep.test.tsx`, `App.test.tsx`
- [ ] Manual: 375 and 390 px, light and dark

**Dependencies:** Tasks 7, 9

**Files:** `src/hooks/useUpkeep.ts`, `src/screens/Upkeep.tsx`, `src/screens/Upkeep.css`, `src/screens/Upkeep.test.tsx`, `src/App.tsx`, `src/App.test.tsx`

**Scope:** M

## Checkpoint D
- [ ] Every success criterion in the spec and every acceptance criterion on #4 is met
- [ ] Tests, lint and build pass
- [ ] On the phone: all three tabs, every open and back, reload on each new screen

## Phase 5: Docs

### Task 11: Docs

**Description:** Record what was built and anything the build settled.

**Acceptance criteria:**
- [x] `specs/004-aspirations-tab.md` is marked approved, with any detail the build settled.
- [ ] `specs/README.md` moves 004 to Done (after Jan's review).
- [x] `../docs/screens/README.md` still matches the tab and the Keep life running page; fixed on its own branch in the parent repo if not.

**Verification:**
- [ ] Manual read-through of both against the running app

**Dependencies:** Task 10

**Files:** `specs/004-aspirations-tab.md`, `specs/README.md`, possibly `../docs/screens/README.md`

**Scope:** S

## Checkpoint E
- [ ] Web-frontend PR open from `aspirations-tab`, referencing #4; a parent-repo PR only if its docs changed
