# Tasks: Mock data and API client (#1)

Plan: [`plan.md`](plan.md). Spec: [`../specs/001-mock-api-client.md`](../specs/001-mock-api-client.md).

Every task: write tests first, then `npm test && npm run lint && npm run build`, then one commit.

## Phase 1: Today is unblocked

### Task 1: `getToday` returns today's tasks with what they reference

**Description:** Add the types `getToday` needs, a mock dataset for today built from a reference date, the store, and `getToday`.

**Acceptance criteria:**
- [x] `types.ts` has `Task`, `Goal`, `Aspiration`, `RecurringItem`, `TimeOfDay`, `TodayPlan` per the spec
- [x] Today's mock tasks include one "by" timed, one "at" timed, one untimed, one maintenance, one goal task, and one task with no goal or recurring item
- [x] `getToday()` returns only tasks planned for today plus exactly the goals, aspirations and recurring items they reference, as copies

**Verification:**
- [x] `npm test`: `client.test.ts` covers filtering, related records, copies, and a late-evening fake time (local date, not UTC)
- [x] `npm run build` type-checks

**Dependencies:** None

**Files:** `src/api/types.ts`, `src/api/mockData.ts`, `src/api/mockStore.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** M (5 files)

### Task 2: `checkOffTask` marks a task done

**Description:** Add `checkOffTask(taskId, valueLogged?)`, which updates the store.

**Acceptance criteria:**
- [ ] Sets `status: 'done'` and `completedAt`, stores `valueLogged` when given, returns the updated task
- [ ] The next `getToday()` shows the task as done; `reset()` restores it
- [ ] An unknown ID rejects with an `Error`

**Verification:**
- [ ] `npm test`: one test per criterion
- [ ] `npm run build` type-checks

**Dependencies:** Task 1

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S (2 files)

## Checkpoint A
- [ ] Tests, lint and build pass
- [ ] Review with Jan; #2 (Today) can start

## Phase 2: Complete the foundation

### Task 3: Remaining types and the full week's dataset

**Description:** Add `Milestone`, `WeeklyTarget`, `Settings` and fill out the dataset to match the spec's Mock dataset section.

**Acceptance criteria:**
- [ ] All seven entities from `../docs/data-model.md` are typed (quitting-goal log omitted)
- [ ] The dataset has the second aspiration and goal, three milestones (hit, upcoming dated, undated), the weekly target, three recurring items, done past-day tasks, bank tasks, a task with `rolloverCount: 2`, and settings
- [ ] A consistency test passes: every reference ID resolves, every `weekOf` is a Monday

**Verification:**
- [ ] `npm test`: consistency test, and Task 1–2 tests still pass
- [ ] `npm run build` type-checks

**Dependencies:** Task 1

**Files:** `src/api/types.ts`, `src/api/mockData.ts`, `src/api/mockData.test.ts`

**Scope:** S–M (3 files)

### Task 4: Lint rule for the mock-data boundary

**Description:** Configure oxlint `no-restricted-imports` so only `src/api/` can import `mockData` or `mockStore`.

**Acceptance criteria:**
- [ ] `npm run lint` passes on the branch
- [ ] A temporary `import ... from './api/mockData.ts'` in `src/App.tsx` makes `npm run lint` fail (then removed)
- [ ] If oxlint can't express this, a Vitest test enforces it instead (no new dependency)

**Verification:**
- [ ] Manual check above, plus `npm run lint`

**Dependencies:** Task 1

**Files:** `.oxlintrc.json`

**Scope:** XS (1 file)

## Checkpoint B
- [ ] Every success criterion in the spec is met
- [ ] Tests, lint and build pass; open the web-frontend PR referencing #1

## Phase 3: Docs

### Task 5: Record the decisions in the parent docs

**Description:** In the parent repo, on its own branch: note camelCase JSON in `CLAUDE.md`, and clarify in `docs/screens/README.md` and `docs/flows.md` that free time is time tasks don't fill.

**Acceptance criteria:**
- [ ] `../CLAUDE.md` Stack section says JSON is camelCase and the API aliases Pydantic fields (`alias_generator=to_camel`)
- [ ] Both docs describe free time as unfilled time, not a group of tasks

**Verification:**
- [ ] Manual read-through; the wording matches the spec's Decisions section

**Dependencies:** None (can run in parallel with Tasks 1–4)

**Files:** `../CLAUDE.md`, `../docs/screens/README.md`, `../docs/flows.md`

**Scope:** S (3 files)

## Checkpoint C
- [ ] Parent-repo PR open, referencing #1
