# Implementation Plan: API client foundation (#40)

Spec: [`../specs/040-api-client-foundation.md`](../specs/040-api-client-foundation.md). Tasks: [`todo.md`](todo.md). (The plan for #7 is in git history at `72d857c`; #6 and #19's at `2e8b3b8`; #5's at `b0e33b6`; #13's at `255c054`; #4's at `f87a231`.)

## Overview

The front end's aspiration types are generated from the API's `openapi.json`, and the mock is made to use them. A build-time switch (`VITE_API=real`) sends the seven aspiration functions in `api/client.ts` to the real API instead of the mock. Every other function stays on the mock. With the switch on, the Aspirations tab and an aspiration's page list, add, edit, reorder, retire and bring back through a local API, reached through a Vite dev proxy. Mock stays the default.

One PR, `api-client-foundation` (closes #40). A small API-repo PR marks shared decisions 6 to 11 confirmed or changed in its map.

## Settled with Jan, 2026-11-18

1. **Aspirations only.** #40 adopts the generated `Aspiration` and its input types. Goal, weekly target and milestone types stay hand-written until #41, which wires those screens. The comments on #40 about goals and milestones are #41's to act on.
2. **An aspiration's page is built from the list in real mode.** The API has no read for one aspiration. The real `getAspiration` calls `listAspirations`, picks the one by id (missing → `NotFoundError`) and counts the active ones. Goals, milestones, recurring items, targets and tasks come back empty until #41. The same goes for `getAspirations` (closes the spec's open question 1).
3. **The client functions keep their signatures.** `moveAspiration(id, 'up' | 'down')` stays. The real one reads the order, swaps the two and posts every active id. `addAspiration` makes the id itself and PUTs it. Hooks and screens don't change.
4. **The switch is build time:** `VITE_API=real`, with an `npm run dev:real` script. Nothing about it ships in the app (closes open question 2).

## Dependency graph

```
openapi-typescript + npm run api:types ──► src/api/openapi.ts (generated)
                                                │
                                                ▼
        types.ts: Aspiration = generated; mock data, mock client, domain/ and hooks follow
                                                │
device ids (ids.ts) ─────────────┐              │
request helper (request.ts) ─────┼──► realAspirations.ts ──► switch in client.ts ──► Vite proxy
errors.ts (NotFoundError) ───────┘                                                   │
                                                                                       ▼
                                                              phone check against a local API
                                                                                       │
                                                                                       ▼
                                                      README, CLAUDE.md, spec, API map (docs)
```

Task 2 (generated types) and Task 3 (ids, request helper) don't share files and can go in either order. Task 4 needs both.

## Architecture decisions

- **Generated file: `src/api/openapi.ts`,** written by `openapi-typescript` (a dev dependency, already approved in the spec; I'll pin the newest release, 7.13.0 today). `npm run api:types` reads `../api/openapi.json`, the sibling repo's committed schema, so the API doesn't have to be running. The file starts with the tool's "do not edit" banner and is excluded from oxlint.
- **`types.ts` names the generated types:** `Aspiration = components['schemas']['Aspiration']` and `NewAspiration = components['schemas']['AspirationInput']`. Empty fields are `null`, not left out: `why`, `position` and `retiredOn`. `retiredOn` is a day, so the mock sets it with `toLocalDay`. The other types in the file stay hand-written for now and say so.
- **The rename runs through the code, not through a mapping.** `priority` becomes `position` and `retiredAt` becomes `retiredOn` in `mockData`, the mock client, `domain/` (aspiration, aspirations, add, today), `useAspiration`, and their tests. The UI copy still says "priority": only the field is renamed. Tests change only in fixtures and field names. Any test whose assertion changes is a finding, and I'll raise it.
- **The switch lives in one place.** `src/api/mode.ts` exports `realApi = import.meta.env.VITE_API === 'real'`. Each of the seven aspiration functions in `client.ts` starts with `if (realApi) return real.xxx(...)`. That's seven one-line branches instead of moving 590 lines of mock into a new file. #43 removes them when real becomes the default.
- **`NotFoundError` moves to `src/api/errors.ts`,** and `client.ts` re-exports it, so `useLoaded` and the tests don't change. This breaks the cycle client → realAspirations → request → client.
- **The request helper (`src/api/request.ts`) is small and written by hand.** It takes `(method, path, body?)` and fetches `/api` + path with JSON in both directions. Every request carries `X-Time-Zone: Intl.DateTimeFormat().resolvedOptions().timeZone`. A 404 throws `NotFoundError`; any other non-2xx, or a network failure, throws a plain `Error` naming the status. Screens already treat every other error as a failed request, so a new error class would have no reader. Field names pass through as they are.
- **Device ids: `newDeviceId()` in `src/api/ids.ts`.** It builds a v4 UUID from `crypto.getRandomValues`, not `crypto.randomUUID`, because the phone opens the dev server over plain http, where browsers leave `randomUUID` out (see the comment on `newId` in `client.ts`). The mock's `addAspiration` uses it too; the mock's other ids stay `newId`. #39 takes this everywhere.
- **The real `moveAspiration` runs one at a time.** It reads the list, swaps the aspiration with its neighbour in position order, and posts every active id. Calls are chained on one promise, so two quick taps read the order the first one left. It returns the active aspirations in order, as the mock does. Moving the first one up, or the last one down, throws, as the mock does.
- **The real `updateAspiration` sends `name` and `why` together,** as the contract requires (a blank `why` is sent as `null`). Its only caller, `useAspiration.edit`, already passes both. The parameter type stays `{ name?: string; why?: string }`. If a field is missing, the real one throws instead of guessing, and a test covers that.
- **`retireAspiration(id, itsWork)` posts `{ itsWork }`** (the API's `Retirement` body), with the time zone header like every request.
- **Dev proxy:** `server.proxy` in `vite.config.ts` sends `/api` to `process.env.API_URL ?? 'http://localhost:8000'`, keeping the path as it is. `npm run dev:real -- --host` serves the phone too, through the same origin, so there's no CORS.
- **Testing the real functions:** `realAspirations.test.ts` and `request.test.ts` stub `fetch` with `vi.stubGlobal`. They check the method, path, header and body, and how each error status is handled. The switch itself has one test that sets `vi.stubEnv('VITE_API', 'real')`, re-imports the client, and checks that `getAspirations` reaches `fetch`. The rest of the suite runs on mock, as now.

## Phases

1. **Contract and plumbing.** Spec settled; generated types with the mock on them; ids and the request helper. → Checkpoint 1 (suite green on mock, build fails if the mock drifts).
2. **Real aspirations.** The real functions, the switch, the proxy. → Checkpoint 2 (every action on the phone against a local API, then with the API off).
3. **Docs.** README, CLAUDE.md, spec built, specs index, API map. → Checkpoint 3, PR closes #40.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The rename ripples into more tests than expected, and a real behaviour change hides in it | Med | It's its own task, with names and fixtures only. Every test assertion that changes gets called out in the commit and the PR. |
| `null` instead of left-out breaks `?.` and `??` checks quietly (`why ?? ''` still works, but `'why' in x` or `!== undefined` don't) | Med | Grep for `!== undefined` and `=== undefined` on aspiration fields during the rename. TypeScript catches assignments. A domain test covers a `null` why. |
| The generated types change shape with the next generator release | Low | Pin the exact version. The generated file is committed, so a diff shows any change. |
| The real reorder races, or the order goes stale between read and post | Low | One chain for calls from this client. The API refuses an order that isn't every active id (409), and that reaches the screen as a failed save and rolls back. |
| The service worker in a built app catches `/api` | Low | Out of scope: real mode runs in dev only until #43. Noted for #8. |
| `../api/openapi.json` isn't there on a machine without the sibling repo | Low | The script names the path; the README says the API repo sits beside this one (the projects layout). |

## Open questions

None. Settled above.
