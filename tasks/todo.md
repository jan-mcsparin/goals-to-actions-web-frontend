# Tasks: Setup screens on the API (#41)

Plan: [`plan.md`](plan.md). Spec: [`../specs/041-setup-screens-on-api.md`](../specs/041-setup-screens-on-api.md).

Every front-end task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

Test dates are fixed to Wednesday 11 Nov 2026. Every API task runs the API repo's four checks (`ruff check`, `ruff format --check`, `mypy`, `pytest`).

### Task 1: Settle spec 041

**Description:** Add plan decision 5 (each milestone's `result`) to the spec, beside decisions 1 and 4, and mark the spec approved. Open question 5 stays an assumption, handed to #42.

**Acceptance criteria:**
- [x] The spec lists decisions 1 to 5, and its status is approved, 2026-11-18.

**Verification:**
- [x] Read the spec against `plan.md`.

**Dependencies:** None

**Files:** `specs/041-setup-screens-on-api.md`

**Scope:** XS

# PR 1, API repo: `goal-reads-for-the-screens`

### Task 2: Progress on listed goals, aspiration and results on the goal page

**Description:** Open an API issue and add it to project #2 with a Status (API #26; PR #27). Then:
- `listGoals` returns each goal with `progress`.
- `getGoal` and every milestone write return `aspiration: { id, name } | null`.
- Each milestone carries `result`, from its latest hit check-in.
- One function holds the progress rule.
- Regenerate `openapi.json` and update the two slice specs.

**Acceptance criteria:**
- [x] `listGoals` counts are the same as `getGoal`'s for every goal: none, some hit, reached, and a deleted milestone left out.
- [x] A goal with no aspiration has `aspiration: null`. A retired aspiration is still named.
- [x] A milestone's `result` is its latest hit check-in's result. It is `null` after "not yet" only, and `null` for a hit with no result.
- [x] `listGoals` is one query for the counts, not one per goal.

**Verification:**
- [x] Four checks pass. `test_contract.py` still guards camelCase.
- [x] `git diff openapi.json` shows only the new fields.

**Dependencies:** Task 1

**Files:** `db/queries/milestones.sql` (+ generated `app/db/`), `app/goals/{routes,models}.py`, `app/milestones/{page,models}.py`, `tests/test_goals.py`, `tests/test_milestones.py`, `openapi.json`, `specs/{goals-targets,milestones-check-ins}.md`

**Scope:** M

## Checkpoint 1
- [x] API PR reviewed and merged.
- [x] In the front end, `npm run api:types` regenerates, the suite is still green, and nothing else is changed.

# PR 2, front end: `setup-screens-on-api` (closes #41, #33; part of #32)

### Task 3: Goals and weekly targets on the generated types

**Description:**
- `Goal`, `WeeklyTarget` and `NewGoal` come from `openapi.ts`.
- In the mock: `endedAt` becomes `endedOn`; `lastReviewedAt` goes; the goal gains `slipped`; empty fields become `null`; the target moves inside the goal (`kind`, `sessions`, `amount`, `unit`, `effectiveFrom`).
- The overview, detail and goal-detail types drop `weeklyTargets`.
- The domain, `useGoal`, `useAdd` and the form read the new shape. Count targets only.

**Acceptance criteria:**
- [ ] No hand-written goal or target type is left in `types.ts`.
- [ ] Every screen looks as it did. The Target sheet and Goal form still say "3 sessions".
- [ ] Any assertion changed beyond a name or fixture is listed in the commit message.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`
- [ ] Renaming a field in `mockData.ts` fails the build.

**Dependencies:** Checkpoint 1

**Files:** `src/api/{types,mockData,client}.ts`, `src/domain/{aspirations,aspiration,goalDetail,week,today,add}.ts`, `src/hooks/{useGoal,useAdd}.ts`, and their tests

**Scope:** L. It's mechanical, but if it passes ~10 source files, split weekly targets into their own task.

### Task 4: Tab and aspiration page counts from each goal's progress

**Description:**
- `AspirationsOverview` and `AspirationDetail` hold `ListedGoal[]`, and lose their `milestones` arrays.
- The mock works out `progress` with the API's rule.
- `milestoneCount` and `goalProgress` read `goal.progress`.

**Acceptance criteria:**
- [ ] "2 of 5" and "Step 3 of 6" read the same as before on the tab and the aspiration page, for active, paused, reached and one-off goals.
- [ ] The mock's progress equals what its goal page gives.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`

**Dependencies:** Task 3

**Files:** `src/api/{types,client}.ts`, `src/domain/{aspirations,aspiration}.ts`, their tests

**Scope:** M

### Task 5: The goal page is the API's page; check-ins are records (#33)

**Description:**
- `getGoal` returns `GoalPage`: the goal, milestones (`position`, `result`), `progress`, `latest` and `aspiration`.
- `Milestone` is generated, so `checkedInOn` goes.
- The mock stores check-ins as rows, and works out `latest` and each milestone's `result` from them.
- `domain/goalDetail.ts` reads `latest`, `progress` and `aspiration` from the page.

**Acceptance criteria:**
- [ ] Every acceptance criterion on #33 is met.
- [ ] "Latest:", "Hit · …" and the goal's aspiration link read as before.
- [ ] Keep, move and adjust after "not yet" leave every check-in row in place.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`

**Dependencies:** Task 3

**Files:** `src/api/{types,mockData,client}.ts`, `src/domain/goalDetail.ts`, `src/hooks/useGoal.ts`, their tests

**Scope:** M

### Task 6: Client functions one per API operation

**Description:** In the mock, these replace the old functions:
- `createGoal`: device id, with the target in the same call.
- `endGoal` and `markGoalReached`.
- `resumeGoal`, `reopenGoal` and `goAgain`.
- `setWeeklyTarget(goalId, target)`, which returns the goal.
- `addMilestone`, `updateMilestone` and `keepMilestone`, each returning the page.
- `checkIn(goalId, milestoneId | null, outcome, result)`, which returns the page. A hit on the goal's line reaches the goal.

`useGoal` and `useAdd` call these. The page that comes back replaces the optimistic one. Resume picks its function from the goal's status.

**Acceptance criteria:**
- [ ] Each mock function enforces the API's rule: only Next can be checked in, and resume, reopen and go again each work only from their own status.
- [ ] Checking in Hit on the goal's line is one call, and the goal shows reached.
- [ ] Screens and their tests don't change.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`

**Dependencies:** Tasks 4, 5

**Files:** `src/api/client.ts`, `src/hooks/{useGoal,useAdd}.ts`, `src/domain/goalDetail.ts`, their tests

**Scope:** M

## Checkpoint 2
- [ ] The suite is green on mock.
- [ ] At phone width, the tab, an aspiration, a building goal, a one-off goal and the Add sheet look as they did on `main`.

### Task 7: Real goal and milestone functions behind the switch

**Description:**
- Add `src/api/realGoals.ts`, with each of Task 6's functions and `getGoal` sent to its route.
- The real `getAspirations` and `getAspiration` add `listGoals`, filtered per aspiration.
- `client.ts` branches on `realApi`.

**Acceptance criteria:**
- [ ] Each real function sends the right method, path and body (stubbed `fetch`).
- [ ] With the switch on, no mock goal or milestone reaches the three screens.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`

**Dependencies:** Task 6

**Files:** `src/api/{realGoals,realGoals.test,realAspirations,realAspirations.test,client}.ts`

**Scope:** M

### Task 8: Check against a local API, and docs

**Description:** Use `npm run dev:real` at phone width, then on the phone. Try each action from the spec's manual list, and reload after each. Then turn the API off and check that failed saves are reported. Record the results in the spec. Update:
- `CLAUDE.md` (which types are generated now, and `realGoals.ts`)
- the specs index (041 done)
- `../docs/` wherever a described behaviour moved
- the API map's note on decision 11

Open the PR, and tick #41's and #33's criteria.

**Acceptance criteria:**
- [ ] Every action in the spec's manual list is kept after a reload.
- [ ] Any finding is either fixed or filed as an issue in project #2.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`
- [ ] The spec's Checked section is filled in.

**Dependencies:** Task 7

**Files:** `specs/041-setup-screens-on-api.md`, `specs/README.md`, `CLAUDE.md`, `../api/specs/README.md`, docs as needed

**Scope:** S

## Checkpoint 3
- [ ] Every success criterion in spec 041 is met.
- [ ] PR open: closes #41 and #33, part of #32.
