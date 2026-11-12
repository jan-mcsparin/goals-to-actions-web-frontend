# Tasks: Shared message (#19), then the Add sheet (#6)

Plan: [`plan.md`](plan.md). Spec: [`../specs/006-add-sheet.md`](../specs/006-add-sheet.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026. New test files call `resetStore()` in `beforeEach`.

# PR 0: `screen-message` (closes #19)

### Task 1: `useFleetingMessage` and `ScreenMessage`

**Description:** `hooks/useFleetingMessage.ts` takes a screen's message and returns `{ shown, dismiss }`. A new message shows and clears itself after 5 s, a tap clears it, and a new message restarts the timer. A `sticky` option keeps it until tapped; the screen passes it when nothing has loaded (a load failure). `components/ScreenMessage.tsx` renders it with `role="status"`, fixed just above the tab bar and clear of the home indicator.

**Acceptance criteria:**
- [x] With fake timers: shown at once, gone after 5 s, gone at once on dismiss; a new message at 4 s shows until 9 s; the same message after it cleared shows again.
- [x] A sticky message stays past 5 s and clears on tap.
- [x] `ScreenMessage` renders nothing without a message, and is a tappable `role="status"` with one.

**Verification:**
- [x] `npm test`: new `hooks/useFleetingMessage.test.tsx`, new `components/ScreenMessage.test.tsx`

**Dependencies:** None

**Files:** `src/hooks/useFleetingMessage.ts`, `src/hooks/useFleetingMessage.test.tsx`, `src/components/ScreenMessage.tsx`, `src/components/ScreenMessage.css`, `src/components/ScreenMessage.test.tsx`

**Scope:** S

### Task 2: Day and Week use it

**Description:** Replace Day's and Week's message paragraphs with `ScreenMessage`. Load failures are sticky; save failures fade. The Bank sheet's inline message stays, on purpose (the sheet covers the bottom of the screen). While a message shows, `.app:has(.screen-message)` adds bottom padding, so the last row isn't covered (one rule in `ScreenMessage.css`, not per screen).

**Acceptance criteria:**
- [x] A failed check-off on Today shows "Couldn't save that. Try again." above the tab bar, and it's gone 5 s later. A second failure shows it again.
- [x] A failed load on Today or Week stays until tapped. Wording is unchanged.

**Verification:**
- [x] `npm test`: `Day.test.tsx`, `Week.test.tsx` (existing `role="status"` queries still pass or are updated)

**Dependencies:** Task 1

**Files:** `src/screens/Day.tsx`, `src/screens/Day.css`, `src/screens/Week.tsx`, `src/screens/Week.css`, tests

**Scope:** M

### Task 3: Aspirations, Aspiration, Upkeep and Goal detail use it

**Description:** Same switch for the other four screens.

**Acceptance criteria:**
- [x] Each screen's save failure fades and its load failure stays, with the wording unchanged.
- [x] No screen still renders its own save or load message. Left inline on purpose: Goal detail's "Milestone hit: …" (it sits by the new Next, where the check-in happened) and the Bank sheet's message (inside the sheet).

**Verification:**
- [x] `npm test`: the four screens' tests

**Dependencies:** Task 2

**Files:** `src/screens/Aspirations.tsx`, `src/screens/Aspiration.tsx`, `src/screens/Upkeep.tsx`, `src/screens/GoalDetail.tsx` (+ their `.css`), tests

**Scope:** M

### Task 3a: Today and Week keep their heading when they can't load

**Description:** Found at the phone check: with a load failure, Today and Week showed only the message on a blank page, while the Aspirations tab kept its title. `useDay` and `useWeek` now give the heading and range without loading, and the screens show the pinned top on a load failure (an opened day keeps "‹ Week").

**Acceptance criteria:**
- [x] Today, an opened day and Week show their heading (and Week its range) when they can't load; no count or bar.

**Verification:**
- [x] `npm test`: `Day.test.tsx`, `Week.test.tsx`

**Dependencies:** Task 3

**Files:** `src/hooks/useDay.ts`, `src/hooks/useWeek.ts`, `src/screens/Day.tsx`, `src/screens/Week.tsx`, tests

**Scope:** S

## Checkpoint 0 (PR 0)
- [x] Tests, lint and build pass
- [x] On the phone, 375 and 390 px, light and dark: the message is seen when scrolled to the bottom of Week and Goal detail, clears the home indicator, and doesn't cover the last row; with a sheet open and the keyboard up, nothing overlaps (checked with a temporary `?fail=save` / `?fail=load` switch, not committed; found Task 3a)
- [x] PR opened, closing #19

# PR 1: `add-sheet-task` (Part of #6)

### Task 4: Settle spec 006

**Description:** Bring the spec in line with plan decisions 1–4 and the architecture decisions that change it: close the open questions, note that the confirmations use `ScreenMessage`, that only the Today screen preselects "On today", and how back works from a new goal. Mark it approved.

**Acceptance criteria:**
- [x] No open questions left; each decision is in the section it changes.
- [x] The repeat-rule texts in the spec match the mock's.

**Verification:**
- [x] Read through against `plan.md`; `npm test && npm run lint && npm run build` still pass

**Dependencies:** Checkpoint 0

**Files:** `specs/006-add-sheet.md`, `tasks/plan.md`

**Scope:** XS

### Task 5: Task rules and `addTask`

**Description:** `domain/add.ts`: `taskWeek(dueDate, today)`, `taskConfirmation(...)` and `taskReady(draft)`. `addTask` stores an `inBank` task in this week, or in its due week when that's later, or a `planned`, `placedByHand` task on today when `onToday` is set.

**Acceptance criteria:**
- [x] `taskWeek`: no date, this week and a past date give this Monday; next week and a date across the year end give that week's Monday. The confirmations are "Added to this week's bank.", "Saved for the week of Nov 23." and "Added to today."
- [x] A task due next week is absent from `getBank` and `getWeek`; one added on today is in `getDay(today)` with `placedByHand`; a plain one is in `getBank`.
- [x] A blank title or an unknown or not-active `goalId` rejects; new records pass the dataset checks.

**Verification:**
- [x] `npm test`: new `domain/add.test.ts`, `client.test.ts` (an `addTask` block)

**Dependencies:** Task 4

**Files:** `src/domain/add.ts`, `src/domain/add.test.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 6: The open screen reloads after an add

**Description:** `hooks/dataRevision.ts`: a context with a number (0 without a provider) and a way for `App` to bump it. The six load hooks list it in their load effect and keep showing what they have while they reload.

**Acceptance criteria:**
- [x] Bumping the revision makes `useDay` and `useWeek` fetch again with no blank state in between.
- [x] Two quick bumps settle on the second load's data.
- [x] Existing hook and screen tests pass unchanged.

**Verification:**
- [x] `npm test`: `useDay.test.tsx`, new `hooks/dataRevision.test.tsx` (`useWeek`, and one of the aspiration hooks)

**Dependencies:** Task 4

**Files:** `src/hooks/dataRevision.ts`, `src/hooks/dataRevision.test.tsx`, `src/hooks/useDay.ts`, `src/hooks/useWeek.ts`, `src/hooks/useAspirations.ts`, `src/hooks/useAspiration.ts`, `src/hooks/useUpkeep.ts`, `src/hooks/useGoal.ts`

**Scope:** M (each hook is a one-line change)

### Task 7: The +, the sheet and the Task tab

**Description:** `TabBar` becomes Today | Week | + | Aspirations; the + is labelled "Add" and is never current. `AddSheet` (titled "Add", tabs Task / Goal / Aspiration / Recurring, the last three empty for now) on `useModalDialog`. `TaskForm`: title, goal picker (active goals), due date, time of day ("by" / "at" and a time), and "In the bank" / "On today". `useAdd(origin)` holds the drafts, loads the pickers when the sheet opens, and saves. On save `App` closes the sheet, bumps the revision and shows the confirmation in its own `ScreenMessage`.

**Acceptance criteria:**
- [x] The + opens the sheet on every screen with the Task title focused; Save is disabled until there's a title; a title alone saves to this week's bank.
- [x] From Today, "On today" is selected and the saved task appears in Today's list. From Week, an opened day or the Aspirations tab, "In the bank" is selected, and a task added while on Week appears in its bank.
- [x] Typed text survives switching tabs and is cleared on close.

**Verification:**
- [x] `npm test`: new `components/AddSheet.test.tsx`, new `hooks/useAdd.test.tsx`, `App.test.tsx`

**Dependencies:** Tasks 5, 6

**Files:** `src/components/TabBar.tsx`, `src/components/TabBar.css`, `src/components/AddSheet.tsx`, `src/components/AddSheet.css`, `src/components/TaskForm.tsx`, `src/hooks/useAdd.ts`, `src/App.tsx`, tests

**Scope:** M (at the top end; TaskForm can be its own commit)

## Checkpoint 1 (PR 1)
- [x] Tests, lint and build pass
- [x] On the phone, 375 and 390 px, light and dark: the + in the tab bar, the keyboard up on open without covering Save, iOS date and time inputs, the confirmation seen after close; added from the check: a tap off any sheet closes it
- [x] PR opened as "Part of #6"

# PR 2: `add-sheet-goal` (Part of #6)

### Task 8: Goal rules, `addGoal` and `addAspiration`

**Description:** `splitGoalSentence`, `goalReady(draft)` (type, label, line, a valid target via `parsedTarget`, deadline not before start via `isWithinGoal`) and `aspirationReady`. `addGoal` stores an active goal, its target from this Monday, and that many `inBank` tasks titled with the label. `addAspiration` puts it last in priority.

**Acceptance criteria:**
- [x] The split handles one colon, several and none, and trims extra spaces.
- [x] Be strong 2 with a target of 3 shows in `getWeek`'s targets with three bank tasks; a quitting goal defaults its start to today; a deadline before the start, a bad target, a target on a non-building goal, a blank label or line, or an unknown or retired aspiration rejects.
- [x] A new aspiration is last of the active ones, with or without a why; a blank name rejects.

**Verification:**
- [x] `npm test`: `add.test.ts`, `client.test.ts`

**Dependencies:** Checkpoint 1

**Files:** `src/domain/add.ts`, `src/domain/add.test.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 9: The Goal tab

**Description:** `GoalForm`. Type first (three buttons, nothing else until one is picked, changeable), then the sentence with the label and line shown back below it, a second field when there's no colon, "What's this for?" (None, an active aspiration, or "New aspiration" with a name), baseline, weekly target (building), start date (quitting), and deadline. On save `App` opens the goal (back per plan decision 3) and shows "Saved. Add milestones when you're ready." ("steps" for one-off).

**Acceptance criteria:**
- [x] On open, only the three types show and they have focus. Without a colon the second field appears, and both are required.
- [x] Saving under Be fit opens the goal's page, and back goes to Be fit; with no aspiration, back goes to the tab. "New aspiration" creates both, and a failed goal save after that doesn't make a second aspiration on retry.
- [x] A building goal with target 3 shows "3 lifting sessions" on its page and three new tasks in Week's bank.

**Verification:**
- [x] `npm test`: `AddSheet.test.tsx`, `useAdd.test.tsx`, `App.test.tsx`

**Dependencies:** Task 8

**Files:** `src/components/GoalForm.tsx`, `src/components/AddSheet.tsx`, `src/hooks/useAdd.ts`, `src/App.tsx`, tests

**Scope:** M

### Task 10: The Aspiration tab and "+ Add a goal for Be fit"

**Description:** `AspirationForm`: name and "What would this give you?". After saving, the sheet stays open on "Saved." with **Add a goal for this** (Goal tab, that aspiration selected) and **Done**. On an active aspiration's page, "+ Add a goal for Be fit" opens the Goal tab with it selected; not on a retired one.

**Acceptance criteria:**
- [ ] An aspiration saves with or without a why and shows last on the tab after Done.
- [ ] "Add a goal for this" opens the Goal tab with the new aspiration selected.
- [ ] The link is on Be fit's page and opens the Goal tab with Be fit selected; a retired aspiration's page has no link.

**Verification:**
- [ ] `npm test`: `AddSheet.test.tsx`, `Aspiration.test.tsx`, `App.test.tsx`

**Dependencies:** Task 9

**Files:** `src/components/AspirationForm.tsx`, `src/components/AddSheet.tsx`, `src/hooks/useAdd.ts`, `src/screens/Aspiration.tsx`, `src/App.tsx`, tests

**Scope:** M

## Checkpoint 2 (PR 2)
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: the Goal form with every field showing scrolls inside the sheet, and the keyboard never hides the field in use or Save
- [ ] PR opened as "Part of #6"

# PR 3: `add-sheet-recurring` (closes #6)

### Task 11: Repeat rules and `addRecurringItem`

**Description:** `repeatRuleText(choice)`, `nextDue(choice, today)` and `recurringReady`. `addRecurringItem` stores an active item, with the aspiration or none (Keep life running).

**Acceptance criteria:**
- [ ] Each choice gives the mock's style of text: "Every Tuesday", "Monthly on the 1st", "Once a week", "3 times a week", "Every two weeks", "Once a month".
- [ ] Next due: a weekday later this week or next week; a monthly day already past this month gives next month's; flexible choices give today.
- [ ] Without an aspiration it's in `getUpkeep`; with Be fit, in `getAspiration`; a blank name or unknown aspiration rejects.

**Verification:**
- [ ] `npm test`: `add.test.ts`, `client.test.ts`

**Dependencies:** Checkpoint 2

**Files:** `src/domain/add.ts`, `src/domain/add.test.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 12: The Recurring tab, "+ Add recurring" and the tab hint

**Description:** `RecurringForm`: name, Fixed day (weekday or 1st–28th) or Flexible (the listed choices), and an optional aspiration. It confirms with "Added. It will show up in the plan when it's next due." An active aspiration's page gets "+ Add recurring". The Aspirations tab's footer hint ends with "Add one with +."

**Acceptance criteria:**
- [ ] Each choice saves the right rule. With no aspiration the item appears on Keep life running; under Be fit it appears on Be fit's card and page.
- [ ] "+ Add recurring" opens the Recurring tab with Be fit selected; not on a retired aspiration.

**Verification:**
- [ ] `npm test`: `AddSheet.test.tsx`, `Aspiration.test.tsx`, `Aspirations.test.tsx`, `App.test.tsx`

**Dependencies:** Task 11

**Files:** `src/components/RecurringForm.tsx`, `src/components/AddSheet.tsx`, `src/hooks/useAdd.ts`, `src/screens/Aspiration.tsx`, `src/screens/Aspirations.tsx`, tests

**Scope:** M

### Task 13: Docs

**Description:** Parent repo (own branch and PR): Flows 1–3 for what the four forms settled (the type picked first, the sentence split, where a task goes, the repeat choices, back from a new goal), and the screen inventory. Front end: spec 006 marked built, and `specs/README.md` moves 006 to Done.

**Acceptance criteria:**
- [ ] Every rule in plan decisions 2–4 appears in `docs/`.
- [ ] No doc says a new task goes onto a day other than today.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`; read-through of the parent diff

**Dependencies:** Task 12

**Files:** `../docs/flows.md`, `../docs/screens/README.md`, `specs/006-add-sheet.md`, `specs/README.md`

**Scope:** S

## Checkpoint 3 (PR 3)
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: the Recurring form, and both links on Be fit's page
- [ ] Every success criterion in spec 006 met
- [ ] PR opened, closing #6, with the parent-repo docs PR linked
