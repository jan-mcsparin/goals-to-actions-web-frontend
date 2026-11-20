# Tasks: Ids made on the device, the phone's time zone, and the check-off's moment (#39)

Plan: [`plan.md`](plan.md). Issue: #39.

Every task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

### Task 1: The check-off carries the moment it was tapped

**Description:** `CheckOff` in `api/types.ts` from the generated schema. `checkOffAt(now)` in `domain/tasks.ts`. `checkOffTask(taskId, checkOff)` in `api/client.ts` stores what it's given. `useDay.toggleDone` makes one `CheckOff`, uses it for the change on screen and sends it.

**Acceptance criteria:**
- [x] `checkOffAt` gives the moment and the local day of the same `Date`; just after midnight is the new day.
- [x] The saved task has the `completedAt` and `completedOn` sent, not a later clock reading (a client test with the clock moved on between tap and save).
- [x] `useDay` sends the same moment it shows.
- [x] `valueLogged`, when sent, is kept.

**Files:** `src/api/types.ts`, `src/domain/tasks.ts` (+ test), `src/api/client.ts` (+ test), `src/hooks/useDay.ts` (+ test)

**Dependencies:** None · **Scope:** S

### Task 2: Ids made on the device for recurring items and tasks

**Description:** `addRecurringItem` and `addTask` in the mock use `newDeviceId()`. `newId` and its counter go.

**Acceptance criteria:**
- [x] A new recurring item and a new task have a version 4 UUID.
- [x] No counter ids remain in `client.ts`.

**Files:** `src/api/client.ts`, `src/api/client.test.ts`

**Dependencies:** None · **Scope:** XS

### Task 3: Settings is the API's

**Description:** `Settings` in `types.ts` becomes the generated `Schemas['Settings']`. `intensitySetOn` and `weekStartsOn` go from the mock data and `setIntensity`. Settings keeps its fixed "Week starts: Monday" row.

**Acceptance criteria:**
- [ ] `getSettings` returns `{ intensity }` only.
- [ ] Settings still shows "Week starts Monday".
- [ ] Tests updated.

**Files:** `src/api/types.ts`, `src/api/mockData.ts` (+ test), `src/api/client.ts` (+ test)

**Dependencies:** None · **Scope:** XS

### Checkpoint: the PR

- [ ] Build, lint and tests pass.
- [ ] `CLAUDE.md`'s note on `types.ts` lists settings among the generated types.
- [ ] PR opened, closing #39.
