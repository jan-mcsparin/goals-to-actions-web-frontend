# Tasks: Recurring items get a structured schedule (#34)

Plan: [`plan.md`](plan.md). Issue: #34.

Every task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

Test dates are fixed to Wednesday 11 Nov 2026.

### Task 1: Word the repeat from a schedule

**Description:** `domain/recurring.ts`: `repeatText(schedule)` and `isFixedDay(schedule)`, taking the generated `Schedule`. Nothing uses them yet.

**Acceptance criteria:**
- [ ] "Every Tuesday", "Monthly on the 1st", "Once a week", "3 times a week", "Every two weeks", "Once a month", including 11th to 13th ordinals.
- [ ] Weekly and monthly are fixed-day; flexible isn't.

**Verification:** `npx vitest run src/domain/recurring.test.ts`; build, lint.

**Dependencies:** None

**Files:** `src/domain/recurring.ts`, `src/domain/recurring.test.ts`

**Scope:** XS

### Task 2: Use the generated RecurringItem everywhere

**Description:** `types.ts` names `RecurringItem`, `NewRecurringItem` and `Schedule` from `openapi.ts`. Mock data and `addRecurringItem` store items the API's way (`createdAt`, `fromGoalId: null`, `active: true`); retire with "keep" sets items' `aspirationId` to null. The form's options read back as a `Schedule`; `recurringInput` sends `schedule` and `startsOn` (today). Upkeep, the aspiration page and Today word or mark items through `domain/recurring.ts`. `RepeatChoice`, `repeatRuleText` and `nextDue` go.

**Acceptance criteria:**
- [ ] `repeatRule`, `fixedDay` and `nextDue` appear nowhere outside `openapi.ts`.
- [ ] The form offers the same choices and saves a schedule and today's `startsOn`.
- [ ] Every screen shows the same repeat text and fixed-day mark as before; mock data and tests updated.

**Verification:** `npm test && npm run lint && npm run build`.

**Dependencies:** 1

**Files:** `src/api/types.ts`, `src/api/mockData.ts`, `src/api/client.ts`, `src/domain/add.ts`, `src/domain/upkeep.ts`, `src/domain/aspiration.ts`, `src/domain/aspirations.ts`, `src/domain/today.ts`, their tests, `src/components/AddSheet.test.tsx`, `src/domain/week.test.ts`

**Scope:** L (mechanical)

## Checkpoint
- [ ] Build, lint and tests pass.

### Task 3: Check the screens at iPhone width

**Description:** A Sonnet agent with the browser looks at the running dev server: Keep life running, an aspiration's page, Today's fixed-day items, and adding a recurring item of each kind.

**Acceptance criteria:**
- [ ] The repeat text reads as before on each screen, and a new item shows up with its repeat.

**Dependencies:** 2

**Files:** none

**Scope:** XS
