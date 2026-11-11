# Tasks: Aspiration page (#13)

Plan: [`plan.md`](plan.md). Spec: [`../specs/013-aspiration-page.md`](../specs/013-aspiration-page.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026, as before. New test files call `resetStore()` in `beforeEach`.

## Phase 1: API

### Task 1: `getAspiration`

**Description:** Make `Aspiration.priority` optional (active only) and drop Speak Spanish's. Add `AspirationDetail` and `getAspiration(aspirationId)`: the aspiration, its goals of every status, their milestones in order, its recurring items (active and inactive), this week's targets and goal tasks for its goals, and `activeCount`.

**Acceptance criteria:**
- [x] Every active aspiration has a priority, numbered 1…n with no gaps; retired ones have none (mock consistency test). The tab and Today sort as before.
- [x] Be fit returns its four goals (three active, one reached), Stretch and Hockey, targets for Be strong and Have endurance, priority 1 and `activeCount` 2. Speak Spanish returns its reached goal and no priority.
- [x] An unknown id rejects; the result is a copy.

**Verification:**
- [x] `npm test`: `mockData.test.ts`, `client.test.ts` (a `getAspiration` block), existing domain tests

**Dependencies:** None

**Files:** `src/api/types.ts`, `src/api/mockData.ts`, `src/api/mockData.test.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `src/domain/aspirations.ts`

**Scope:** S

### Task 2: Edit, review, move and bring back

**Description:** `updateAspiration`, `reviewAspiration`, `moveAspiration` and `bringBackAspiration`, with #1's rules.

**Acceptance criteria:**
- [x] `updateAspiration` changes name and why; an empty or blank name rejects. `reviewAspiration` sets `lastReviewedAt` to today.
- [x] `moveAspiration` swaps priority with the one above or below and returns the active ones in order; moving the first up, the last down, or a retired one rejects.
- [x] `bringBackAspiration` makes it active, clears `retiredAt`, and gives it priority `activeCount + 1`; its paused goals stay paused. Bringing back an active one rejects.

**Verification:**
- [x] `npm test`: `client.test.ts`, one block per function

**Dependencies:** Task 1

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 3: `retireAspiration`

**Description:** `retireAspiration(id, 'pause' | 'keep')`. Pause: active goals → paused, recurring items → inactive, their not-done tasks this week → `skipped` (day kept). Keep: active and paused goals and recurring items lose `aspirationId`. Both: status retired, `retiredAt` now, priority cleared and the ones below moved up; reached and ended goals keep their aspiration. `getDay` leaves out skipped tasks.

**Acceptance criteria:**
- [x] Pause on Be fit: its goals paused, Stretch and Hockey inactive, this week's planned and bank tasks for them skipped, done tasks untouched, hand-placed ones included.
- [x] After that, `getDay`, `getBank`, `getWeek` (day lines and progress rows) and `getUpkeep` show none of them, and Be fit's paused goals aren't in Week's progress.
- [x] Keep on Be fit: goals and items have no aspiration and are otherwise unchanged; Run a 5k stays with Be fit. Either way Be fit has no priority and Keep a calm home becomes 1. Retiring a retired one or an unknown id rejects.

**Verification:**
- [x] `npm test`: `client.test.ts`; `domain/week.test.ts` if the progress check needs a domain case

**Dependencies:** Task 2

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** M

## Checkpoint A
- [x] Tests, lint and build pass
- [x] Today, Week, the tab and Keep life running behave as before

## Phase 2: The page, shown

### Task 4: `domain/aspiration.ts`

**Description:** `aspirationPage(detail, today)` returns the active or retired view: header, this week (count, "6 days left", bar values), goal cards (active then paused, each with progress label, measurable line, milestone bar values and week line), recurring rows, past goals, priority line and which moves apply, history line. Widen `goalProgress` and `weekCount` to `Pick<…>`; export `daysLeft` from `domain/week.ts`.

**Acceptance criteria:**
- [x] Goal cards: "This week: 1 of 3 lifting sessions", "No weekly target yet" for a building goal without one, no week line for one-off or quitting, "Paused" for paused; This week left out when no goal has a target.
- [x] `priorityLine` for 1st, 2nd, 3rd and "1st of 1 aspiration"; move up off for the first, down off for the last, both off when alone.
- [x] History line leaves out zeros and adds the year only when it isn't this year; the retired view has "Retired Nov 10", past goals, paused goals and recurring items marked "Paused", and nothing else.

**Verification:**
- [x] `npm test`: new `domain/aspiration.test.ts`; `aspirations.test.ts` and `week.test.ts` still pass

**Dependencies:** Task 1

**Files:** `src/domain/aspiration.ts`, `src/domain/aspiration.test.ts`, `src/domain/aspirations.ts`, `src/domain/week.ts`

**Scope:** M

### Task 5: `useAspiration` and the page, show-only

**Description:** The hook loads the detail and returns the view, a message, and `notFound`. `screens/Aspiration.tsx` replaces the placeholder: pinned header ("‹ Aspirations", "Aspiration"), name and why, This week, goal cards as buttons, Recurring, Past goals in `<details>`, Priority (buttons present, not wired), the three actions (not wired). App passes `onOpenGoal` with `from: { screen: 'aspiration', aspirationId }`. Not found calls `onBack`.

**Acceptance criteria:**
- [x] Be fit renders as in `aspirations.png`; a goal card opens that goal, and back returns to Be fit.
- [x] Past goals is closed at first and opens to "Run a 5k · Reached".
- [x] A remembered aspiration id that doesn't exist lands on Aspirations (App test).

**Verification:**
- [x] `npm test`: new `hooks/useAspiration.test.tsx` (loads, not found), new `screens/Aspiration.test.tsx`, `App.test.tsx`
- [x] Manual: 375 px, light and dark, a long why

**Dependencies:** Task 4

**Files:** `src/hooks/useAspiration.ts`, `src/hooks/useAspiration.test.tsx`, `src/screens/Aspiration.tsx`, `src/screens/Aspiration.css`, `src/screens/Aspiration.test.tsx`, `src/App.tsx`, `src/App.test.tsx`

**Scope:** M (L on file count, but most are new and small)

## Checkpoint B
- [x] Tests, lint and build pass
- [x] On the phone: open each aspiration from the tab, open a goal and come back, reload on the page

## Phase 3: Managing

### Task 6: Move up and move down

**Description:** The Priority buttons call the hook's `move`, which updates `position` at once and rolls back with "Couldn't save that. Try again." on failure.

**Acceptance criteria:**
- [x] Move Be fit down: "2nd of 2 aspirations", down disabled, up enabled; move up restores it.
- [x] A failed move rolls back and shows the message (hook test, mocked client).
- [x] After moving, the tab's cards are in the new order (App test).

**Verification:**
- [x] `npm test`: `useAspiration.test.tsx`, `Aspiration.test.tsx`, `App.test.tsx`
- [ ] Manual: Week's progress rows and Today's By goal view follow

**Dependencies:** Tasks 2, 5

**Files:** `src/hooks/useAspiration.ts`, `src/hooks/useAspiration.test.tsx`, `src/screens/Aspiration.tsx`, `src/screens/Aspiration.test.tsx`, `src/App.test.tsx`

**Scope:** S

### Task 7: Edit name and why

**Description:** `AspirationEditSheet`: name (required) and why (optional, placeholder "What would this give you?"). Save is disabled while the name is blank; saving updates the page at once, rolling back on failure.

**Acceptance criteria:**
- [x] Opens only from "Edit name and why", pre-filled; no dialog open on first render.
- [x] Saving changes the header; clearing the why removes it.
- [x] Cancel and Escape change nothing.

**Verification:**
- [x] `npm test`: `Aspiration.test.tsx`

**Dependencies:** Tasks 2, 5

**Files:** `src/components/AspirationEditSheet.tsx`, `src/components/AspirationEditSheet.css`, `src/hooks/useAspiration.ts`, `src/screens/Aspiration.tsx`, `src/screens/Aspiration.test.tsx`

**Scope:** S

### Task 8: Retire

**Description:** `RetireSheet`, titled "Retire Be fit?": the history line, "What should happen to its goals and recurring items?", Pause them (selected) and Keep them going with their lines, the note, "Retire Be fit" and Cancel. Retiring waits for the save, then App goes to Aspirations.

**Acceptance criteria:**
- [x] The sheet leads with "Since October: 1 goal reached, 3 goals active, 2 recurring items." and Pause them is selected.
- [x] Each choice does what it says; afterwards the tab shows Be fit under Retired, and with Keep them going its goals under Other goals (App tests).
- [x] A failed retire stays on the page with the message.

**Verification:**
- [x] `npm test`: `Aspiration.test.tsx`, `App.test.tsx`
- [ ] Manual: fits without scrolling at 375 px

**Dependencies:** Tasks 3, 5

**Files:** `src/components/RetireSheet.tsx`, `src/components/RetireSheet.css`, `src/hooks/useAspiration.ts`, `src/screens/Aspiration.tsx`, `src/App.tsx`, tests

**Scope:** M

### Task 9: Review

**Description:** `ReviewSheet`: the name, "Still the right aspiration?", "Still in the right place?" with "1st of 2", and Keep as is, Edit name and why, Move it, Retire. Each records the review, then: closes; opens Edit; closes and focuses the Priority heading; opens Retire.

**Acceptance criteria:**
- [ ] Each choice sets `lastReviewedAt` to today and leads where described.
- [ ] Nothing opens it but the Review button: no prompt, badge or reminder anywhere.

**Verification:**
- [ ] `npm test`: `Aspiration.test.tsx`, plus a hook check that review is optimistic

**Dependencies:** Tasks 6, 7, 8

**Files:** `src/components/ReviewSheet.tsx`, `src/hooks/useAspiration.ts`, `src/screens/Aspiration.tsx`, `src/screens/Aspiration.test.tsx`

**Scope:** S

### Task 10: A retired aspiration's page and Bring back

**Description:** The retired view renders: name, why, "Retired Nov 10", past goals, goals and recurring items paused by retiring (goals open), and one action, Bring back. Bring back waits for the save, then shows the active page, last in priority.

**Acceptance criteria:**
- [ ] Speak Spanish shows only what the spec lists; no This week, Priority, Edit, Review or Retire.
- [ ] Retire Be fit with Pause them, open it from Retired, bring it back: "2nd of 2 aspirations", its goals still Paused.
- [ ] A failed bring back stays on the retired page with the message.

**Verification:**
- [ ] `npm test`: `Aspiration.test.tsx`, `App.test.tsx`

**Dependencies:** Tasks 2, 8

**Files:** `src/hooks/useAspiration.ts`, `src/screens/Aspiration.tsx`, `src/screens/Aspiration.css`, tests

**Scope:** S

## Checkpoint C
- [ ] Every success criterion in the spec and every acceptance criterion on #13 is met
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: every sheet, reorder then Week and Today, retire both ways, bring back, reload on the page

## Phase 4: Docs

### Task 11: Docs

**Description:** Record what was built and anything the build settled.

**Acceptance criteria:**
- [ ] `specs/013-aspiration-page.md` is marked approved, with priority for active ones only, the history line's year and the open question moved to #5.
- [ ] `specs/README.md` moves 013 to Done (after Jan's review), and spec 005 notes the resume question.
- [ ] `../docs/data-model.md` says priority is for active aspirations only; it and `../docs/flows.md` say set-aside tasks include ones placed by hand and keep their day. Own branch and PR in the parent repo.

**Verification:**
- [ ] Read-through against the build

**Dependencies:** Task 10

**Files:** `specs/013-aspiration-page.md`, `specs/005-goal-detail.md`, `specs/README.md`, possibly `../docs/flows.md`, `../docs/data-model.md`

**Scope:** S

## Checkpoint D
- [ ] Web-frontend PR open from `aspiration-page`, referencing #13
- [ ] Parent-repo docs PR, if any
