# Spec: Real by default (#43, part a)

Status: draft 2026-11-20. The first of four parts of [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43) (module `api-by-default` in the [map](README.md)): **a real by default** → b [stored week and queue](043b-stored-week-and-queue.md) → c [other screens offline](043c-other-screens-offline.md) → d [sign-in around the queue](043d-sign-in-around-the-queue.md). Depends on the API's [`settings-sync`](../../api/specs/settings-sync.md) slice (built).

## Objective

The app talks to the API unless told otherwise. Settings is the last screen still on mock data; it moves over, and then nothing needs the mock except tests and the click-through. Two leftovers from #40's checks are fixed on the way: screens read the same list two or three times.

This part stores nothing on the phone and queues nothing. A change still shows once the API answers and fails offline with "Couldn't save that. Try again.", as after #42. Parts b to d change that.

### What exists afterwards

1. **Real is the default.** `npm run dev` and `npm run build` talk to the API. The mock is chosen with `VITE_API=mock`: `npm run dev:mock` for the click-through, and every test run (set in `vite.config.ts`'s `test.env`). `dev:real` goes.
2. **Settings on the API.** `getSettings` reads `GET /settings`, `setIntensity` sends `PUT /settings/intensity`, in a new `api/realSettings.ts`. The screen doesn't change.
3. **Each read once.** Opening a screen or the Add sheet sends each `GET` it needs once (not counting React's development double-run). The Add sheet's pickers read aspirations and goals only, not the whole Aspirations tab (recurring items and the week as well).
4. **The mock stays as it is** (settled 1 below). Shared decision 23 changes from "shrinks when real is the default" to "stays for tests and `dev:mock`".

### Moved out of #43

- **The quitting goal's daily answer and delete** are in #43's criteria, but no screen offers either yet. They go through the API when #37 and #38 build their screens; #37 adds its two writes to the queue that part b builds.

## Scope

**In:**

- `src/api/mode.ts`: `realApi = import.meta.env.VITE_API !== 'mock'`.
- `package.json` scripts; `vite.config.ts` `test.env: { VITE_API: 'mock' }`.
- `src/api/realSettings.ts` (+ test); `client.ts` routes `getSettings` and `setIntensity`.
- The Add sheet's choices: a client function for the pickers (`getChoices`: aspirations and goals) in mock and real; `useAdd` calls it.
- Finding and removing any other repeated read the checks turn up (decision 2).
- `README.md` (how to run each mode), `CLAUDE.md` (mock or real), `specs/README.md` decision 23.

**Out:**

- Anything stored on the phone, the queue (parts b, c).
- The session-ended sheet (part d).
- Shrinking or deleting the mock.

## Commands

```bash
nvm use                 # Node 24
npm test                # runs on the mock (test.env)
npm run lint
npm run build           # a real build
npm run dev             # against the local API, which Jan runs
npm run dev:mock        # the click-through
```

## Project structure

Unchanged, plus `src/api/realSettings.ts` and its test.

## Code style

As spec 042. A real function:

```ts
// Today's intensity for this account; the planner reads it when it fills a week.
export async function setIntensity(intensity: Intensity): Promise<Settings> {
  return request('PUT', '/settings/intensity', { intensity })
}
```

## Testing strategy

- `realSettings.test.ts`: method, path and body against a stubbed `fetch`, as `realGoals.test.ts` does.
- `mode` default: a test that `realApi` is false under the test env (so no test reaches a network).
- `useAdd.test.tsx`: the sheet asks for its choices once.
- **Manual, by a Sonnet agent at phone width against the local API:** Settings shows the API's intensity, a change survives a reload; the network log on opening Today, Week, Aspirations, an aspiration, a goal, Keep life running, Settings and the Add sheet shows each `GET` once (after the double-run).

## Boundaries

- **Always:** screens call `api/` only; `nvm use`, then test, lint and build before each commit; one commit per task.
- **Ask first:** any new dependency; any API change.
- **Never:** let a test reach the network; hand-write an API type.

## Success criteria

- [ ] `npm run dev` and the build use the API; `npm run dev:mock` and every test use the mock.
- [ ] Settings reads and saves intensity through the API.
- [ ] Each screen and the Add sheet read each list once.
- [ ] README, CLAUDE.md and decision 23 say how the modes work now.

## Settled with Jan, 2026-11-20

1. **The mock stays whole.** Tests and the click-through use all of it; it can go later if it gets in the way.
2. **The double reads are traced first,** with the network log, in the plan's first task; the fix follows what that finds.
