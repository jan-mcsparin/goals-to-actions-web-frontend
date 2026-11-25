# CLAUDE.md: goals-to-actions-web-frontend

The front end for Goals to Actions. Product context, rules and ADRs live in the parent folder (`../CLAUDE.md`, `../docs/`). Read `../docs/product-rules.md` before planner or UI work.

## Stack

React + Vite + TypeScript, client-rendered, no SSR. PWA via vite-plugin-pwa (manifest + service worker) from the start. Mobile-first; must also work on a laptop.

## Structure

```
src/
  config.ts        APP_NAME and other product constants (the only place the name appears in code)
  api/             API client functions + types. openapi.ts is generated; realAspirations.ts, realGoals.ts, realPlan.ts and realSettings.ts are the parts on the real API; queue.ts sends the queued plan changes in order (ADR-010); stored.ts says whether anything of the person's is stored and clears it all on sign-out (ADR-012); signIn.ts signs in with a passkey
  domain/          plain TS: what screens show, drawn from what the API sends (a day and the bank from the week, grouping, wording, pacing lines), and how a change shows before the API answers. No planning or rollover rules: the server owns those (ADR-008). No React imports. Unit-tested.
  storage/         On-device storage: the week documents, the queue and every other read's last response in IndexedDB (planStore.ts, memory where there's none, as in tests); Today's view choice, the open screen and the like in localStorage
  hooks/           React hooks wrapping api/, domain/ and storage/
  screens/         Day (Today and any opened day), Week, Aspirations, Aspiration, Upkeep (Keep life running), GoalDetail, Settings, SignIn (in place of the app while signed out with nothing stored; a session that ends over stored data keeps the screen, with the session-ended sheet, then a banner); Add is a sheet
  components/      presentational pieces only
```

## Rules

- **Product name in one place:** `src/config.ts` exports `APP_NAME`; the PWA manifest `name`/`short_name` in `vite.config.ts` reads it. Don't hard-code the name anywhere else.
- **Instant open (ADR-004, ADR-010):** precache the app shell; Today, a day, the bank and Week show the stored week first, then the fresh read (`hooks/useStoredWeeks.ts`), with the queue's changes replayed on top (`domain/replay.ts`). Every other screen opens from its read's last response, kept under the read's key (`useLoaded('goal/<id>', …)`), then the fresh one; a failed load keeps what's shown. Check off, uncheck, place, back to bank, swap and add a task go through `api/queue.ts`, never straight to the client; nothing else is queued. Persist current screen and view toggle.
- **Saves that aren't queued** and show at once go through `hooks/useSavesOnTheirWay.ts`: every failure shows "Couldn't save that. Try again.", and once none are on their way the screen reads its record again (`useLoaded`'s `reload()`), never rolling back to a guess. Each screen passes its hook's `clearMessage` to `useFleetingMessage` as `onGone`, so the same message twice shows twice.
- **Navigation goes through `useNavigation()`** (`hooks/useNavigation.ts`). No router yet: the open screen is state, remembered in `localStorage`. Adding real URLs later means changing that hook and `App.tsx`, not the screens.
- **Keep logic out of components.** Components render; `domain/` and `hooks/` decide.
- **Mock data for tests and the click-through:** screens call the same `api/` functions either way. Mock data follows `../docs/data-model.md` and the "Be fit / Be strong" example.
- **Mock or real is one build-time switch:** real is the default; `VITE_API=mock` (`npm run dev:mock`, read in `api/mode.ts`) uses the mock, and every test run sets it (`vite.config.ts`). The functions keep their signatures either way, and only `api/request.ts` calls `fetch`.
- **API types are generated**, never hand-written: `npm run api:types` writes `src/api/openapi.ts` from `../api/openapi.json`; never edit it. `api/types.ts` names the generated types where the API has defined them (aspirations, goals, weekly targets, milestones, the goal's page, tasks, the week, a new task, recurring items, settings and the check-off) and hand-writes only what the client builds from several reads (the Aspirations tab, an aspiration's page, Keep life running, the Add sheet's choices). The mock stores some records differently from how the API sends them (`StoredGoal`, `StoredMilestone`, `StoredTask` (a task plus whether it's set aside) and check-ins as rows in `mockData.ts`) and builds what it returns the API's way, imitating the server's answers (where a task goes, what closing a week does, "Still matter?") so tests and the click-through work; it stays whole (spec 043a). Regenerate after every API change.
- Test `domain/` with Vitest. Check layouts at iPhone width.
- Update `../docs/` in the same change when behavior changes.
