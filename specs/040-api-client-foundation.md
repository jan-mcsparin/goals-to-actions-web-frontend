# Spec: API client foundation (#40)

Status: draft 2026-11-13; finalised when its plan is written, after the API's `aspirations` slice is built. Issue: [#40](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/40). Module `api-client-foundation` in the [map](README.md). Depends on the API's [`aspirations`](../../api/specs/aspirations.md) spec.

## Objective

Prove the whole path from a screen to the database once, early, on the smallest feature there is. The types and client are generated from the API's schema, a switch chooses mock or real, and the Aspirations tab runs on real data when the switch says so.

The point is to find out whether the API's write conventions work from a real phone-shaped client (device-made ids, creates safe to repeat, the time zone on every request, the error shape) while they are one slice old, not eleven.

Mock stays the default. Nothing changes for the click-through.

References: [the API map](../../api/specs/README.md) (shared decisions 6 to 12), [ADR-003](../../docs/adr/0003-fastapi-postgres.md), [ADR-004](../../docs/adr/0004-instant-open.md), issue #39.

### What exists afterwards

1. **Generated types.** One command reads the API's OpenAPI schema and writes the types. The file is committed, never edited by hand, and regenerated after every API slice.
2. **The mock checked against them.** Where the API has defined a shape (aspirations, to start), the mock's types are the generated ones, so the mock can't drift from the contract.
3. **A switch.** One setting chooses mock or real for the whole app. Screens and hooks don't know which they got: `api/client.ts` keeps its function signatures.
4. **One real screen.** With the switch on real, the Aspirations tab lists, adds, edits, reorders, retires and brings back aspirations through the API.
5. **The request plumbing every later screen reuses:** the phone's time zone on every request, ids made on the device, the API's 404 arriving as `NotFoundError`, any other failure as a failed request.

With the switch on real, screens that aren't wired yet still show mock data, and it won't line up with the real aspirations (the mock goals belong to mock aspirations). That is accepted: real mode is for proving the path until #41.

## Scope

**In:**

- A script that regenerates the types, and the generated file under `src/api/`.
- `src/api/`: the real implementations of the aspiration functions beside the mock ones; the choice between them in one place; a small request helper (base URL, time zone header, JSON, errors).
- A device-made id for a new aspiration (`crypto.randomUUID()`), in both mock and real.
- Reaching a local API from the dev server, and from the phone on the same network.
- `README.md`: running against a local API. `CLAUDE.md`: the generated file and the switch.

**Out (later):**

- Any other screen on the API (#41, #42, #43).
- The stored plan, optimistic updates beyond what exists, the offline queue (#43).
- Ids and the time zone on everything else (#39).
- Hosting, and sign-in.
- Removing the mock. It stays for tests and for the click-through.

## Testing strategy

- **Request helper:** sends the time zone header; a 404 becomes `NotFoundError`; a 500 and a network failure both become a failed request; the body is camelCase both ways with no mapping of names.
- **Aspiration functions, real:** each calls the right operation with the right body, against a stubbed `fetch`. A create sent twice with the same id is one aspiration (checked against the running API by hand).
- **The existing suite passes unchanged on mock.** If a test has to change, a signature changed, and that is a finding.
- **Type check:** `npm run build` fails if the mock's aspirations stop matching the generated types.
- **Manual, recorded in the PR:** every aspiration action on the phone against a local API; turn the API off and check the screen reports it the way it reports a failed save today.

## Boundaries

- **Always:** screens and hooks keep calling the same `api/` functions; mock is the default; run test, lint and build before each commit.
- **Ask first:** any new dependency beyond `openapi-typescript`; a change to an `api/` function's signature; a change the API should make instead of the front end adapting.
- **Never:** hand-write or edit an API type; call `fetch` from a screen or hook; map field names by hand (if a name differs, the contract is wrong).

## Success criteria

- [ ] Every acceptance criterion on #40 is met.
- [ ] Types regenerate with one command and the result is committed.
- [ ] The Aspirations tab works fully on the real API with the switch on, and on mock with it off.
- [ ] Each of the API's assumed decisions 6 to 11 is marked confirmed, or changed, in the API map.
- [ ] `npm test`, `npm run lint`, `npm run build` pass.

## Settled with Jan, 2026-11-13

1. **The generator is `openapi-typescript`,** a dev dependency, types only. The request helper is written by hand; no `openapi-fetch`.
2. **The schema is a file the API repo commits** (`openapi.json`, added by the API's `aspirations` slice). Types are regenerated from it without starting the API.
3. **A proxy in the Vite dev server** (`/api` to the local API) reaches the API in development, from the laptop and the phone. CORS is decided with hosting.

## Open questions

1. **The tab's read is bigger than the API's.** `getAspirations` returns counts and goals alongside the aspirations; the API's `listAspirations` returns aspirations alone until `goals-targets`. In real mode the tab shows each aspiration with no goals until #41. Is that fine for the proof?
2. **The switch.** A build-time setting (`VITE_API=real`), so nothing about it ships in the app. Or something tappable in Settings for trying both on the phone. I'd use the build-time setting.
