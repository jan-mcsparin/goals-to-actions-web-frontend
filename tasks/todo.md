# Tasks: API client foundation (#40)

Plan: [`plan.md`](plan.md). Spec: [`../specs/040-api-client-foundation.md`](../specs/040-api-client-foundation.md).

Every task: `nvm use` (Node 24), write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026. New test files call `resetStore()` in `beforeEach`; files that stub `fetch` restore it in `afterEach`.

# PR: `api-client-foundation` (closes #40)

### Task 1: Settle spec 040

**Description:** Close both open questions (plan decisions 2 and 4) and add plan decisions 1 and 3 to the spec. Correct the id line in the spec: `getRandomValues`, not `randomUUID`. Mark the spec approved.

**Acceptance criteria:**
- [ ] No open questions left; each decision is in the section it changes.
- [ ] Status reads approved, dated 2026-11-18.

**Verification:**
- [ ] Read through against `plan.md`; `npm test && npm run lint && npm run build` still pass

**Dependencies:** None

**Files:** `specs/040-api-client-foundation.md`

**Scope:** XS

### Task 2: Generated types, and the mock's aspirations on them

**Description:** Add `openapi-typescript` (pinned) and `npm run api:types`, which writes `src/api/openapi.ts` from `../api/openapi.json`. Exclude it from oxlint. `types.ts` takes `Aspiration` and `NewAspiration` from it. The mock data, the mock client, `domain/` and `useAspiration` follow: `priority` becomes `position`, `retiredAt` becomes `retiredOn` (a day), and empty fields are `null`. Tests change in fixtures and field names only.

**Acceptance criteria:**
- [ ] `npm run api:types` regenerates the file, and running it again changes nothing.
- [ ] Changing a field of an aspiration in `mockData.ts` to the old name fails `npm run build`.
- [ ] The full suite passes on mock. Any assertion that had to change, beyond a name or fixture, is listed in the commit message.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`; `git diff --stat` shows only the files named below

**Dependencies:** Task 1

**Files:** `package.json`, `package-lock.json`, `src/api/openapi.ts`, `src/api/types.ts`, `src/api/mockData.ts`, `src/api/client.ts`, `src/domain/{aspiration,aspirations,add,today}.ts`, `src/hooks/useAspiration.ts`, and their tests

**Scope:** L, but mechanical: one rename across files, with no new behaviour. It isn't split, because no half of it compiles.

### Task 3: Device ids and the request helper

**Description:** `src/api/ids.ts` has `newDeviceId()`, a v4 UUID made with `crypto.getRandomValues`. `src/api/errors.ts` gets `NotFoundError`, which `client.ts` re-exports. `src/api/request.ts` has `request(method, path, body?)` as in the plan. The mock's `addAspiration` uses `newDeviceId()`.

**Acceptance criteria:**
- [ ] `newDeviceId()` matches the v4 UUID pattern and works with `crypto.randomUUID` removed.
- [ ] `request` sends `X-Time-Zone` and JSON to `/api/…`; a 404 throws `NotFoundError`; a 500, a 409 and a rejected `fetch` each throw an error that isn't `NotFoundError`; a camelCase body goes out and comes back unchanged.
- [ ] A new mock aspiration has a UUID id; `useLoaded` and the existing tests still import `NotFoundError` from `client.ts`.

**Verification:**
- [ ] `npm test`: new `ids.test.ts` and `request.test.ts`; `client.test.ts`

**Dependencies:** None (can go before or after Task 2)

**Files:** `src/api/ids.ts`, `src/api/errors.ts`, `src/api/request.ts`, `src/api/client.ts`, tests

**Scope:** S

## Checkpoint 1
- [ ] Tests, lint and build pass on mock
- [ ] The click-through is unchanged in the browser: Aspirations tab, an aspiration's page, Add an aspiration

### Task 4: The real aspiration functions

**Description:** `src/api/realAspirations.ts` implements the seven functions over `request`, as in the plan: `getAspirations` and `getAspiration` from `listAspirations`; `addAspiration` as a PUT with a device id; `updateAspiration` sending both fields; `moveAspiration` chained (read, swap, post the order); `retireAspiration` with `{ itsWork }`; `bringBackAspiration`.

**Acceptance criteria:**
- [ ] Each function calls the right method and path with the right body, against a stubbed `fetch`, and returns the shape its mock twin returns.
- [ ] `getAspiration` for an id not in the list throws `NotFoundError`; `moveAspiration` posts every active id with the two swapped, and two calls made together post orders built on each other.
- [ ] `updateAspiration` without both fields throws before any request; a blank why goes out as `null`.

**Verification:**
- [ ] `npm test`: new `realAspirations.test.ts`

**Dependencies:** Tasks 2, 3

**Files:** `src/api/realAspirations.ts`, `src/api/realAspirations.test.ts`

**Scope:** M

### Task 5: The switch and the dev proxy

**Description:** `src/api/mode.ts` reads `VITE_API`. The seven aspiration functions in `client.ts` hand off to the real ones when it's `real`. `vite.config.ts` proxies `/api` to `API_URL` (default `http://localhost:8000`). `package.json` gets `dev:real`. `vite-env.d.ts` types `VITE_API`.

**Acceptance criteria:**
- [ ] Without `VITE_API`, nothing calls `fetch` (the existing suite with `fetch` stubbed to fail).
- [ ] With `VITE_API=real`, `getAspirations` reaches `fetch` at `/api/aspirations`, and `getDay` still answers from the mock.
- [ ] `npm run dev:real` serves the app, and `/api/health` answers through the proxy while the API runs.

**Verification:**
- [ ] `npm test`: new `mode` test in `client.test.ts`; `curl localhost:5173/api/health` with the API running

**Dependencies:** Task 4

**Files:** `src/api/mode.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `vite.config.ts`, `package.json`, `src/vite-env.d.ts`

**Scope:** M

## Checkpoint 2
- [ ] Tests, lint and build pass
- [ ] Against a local API, on the phone (`npm run dev:real -- --host`, run by Jan): list, add, edit the name and why, move up and down, retire with each choice, bring back. Each one is still there after a reload, and `/api/docs` agrees.
- [ ] A create sent twice with the same id (curl with the id from a real add) makes one aspiration
- [ ] With the API stopped: the tab shows its load message; a save on the page rolls back with "Couldn't save that. Try again."; an aspiration id that isn't there goes back quietly
- [ ] Results recorded for the PR

### Task 6: Docs

**Description:** README: running against a local API (start the API, `npm run dev:real`, `-- --host` for the phone, `API_URL`, `npm run api:types` after each API slice). CLAUDE.md: the generated file is never edited, and how the switch works; `types.ts` is part generated now. Spec 040 marked built; `specs/README.md` moves 040 to Done. API repo, on its own branch and PR: shared decisions 6 to 11 marked confirmed from the front end, or changed, with what the wiring found.

**Acceptance criteria:**
- [ ] Someone with both repos side by side can run the front end on the real API from the README alone.
- [ ] `specs/README.md` lists 040 under Done; the API map says what #40 confirmed.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`; read-through of both diffs

**Dependencies:** Checkpoint 2

**Files:** `README.md`, `CLAUDE.md`, `specs/040-api-client-foundation.md`, `specs/README.md`, `../api/specs/README.md`

**Scope:** S

## Checkpoint 3
- [ ] Tests, lint and build pass
- [ ] Every success criterion in spec 040 and every acceptance criterion on #40 met
- [ ] PR opened, closing #40, with the phone results and the API-repo PR linked
