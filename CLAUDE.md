# CLAUDE.md: goals-to-actions-web-frontend

The front end for Goals to Actions. Product context, rules and ADRs live in the parent folder (`../CLAUDE.md`, `../docs/`). Read `../docs/product-rules.md` before planner or UI work.

## Stack

React + Vite + TypeScript, client-rendered, no SSR. PWA via vite-plugin-pwa (manifest + service worker) from the start. Mobile-first; must also work on a laptop.

## Structure

```
src/
  config.ts        APP_NAME and other product constants (the only place the name appears in code)
  api/             API client functions + types. openapi.ts is generated; realAspirations.ts and realGoals.ts are the parts on the real API
  domain/          plain TS: planning, pacing, rollover rules. No React imports. Unit-tested.
  storage/         On-device storage: Today's view choice and the open screen (localStorage) now; IndexedDB plan cache + offline queue later, once there's an API
  hooks/           React hooks wrapping api/, domain/ and storage/
  screens/         Day (Today and any opened day), Week, Aspirations, Aspiration, Upkeep (Keep life running), GoalDetail, Settings; Add is a sheet
  components/      presentational pieces only
```

## Rules

- **Product name in one place:** `src/config.ts` exports `APP_NAME`; the PWA manifest `name`/`short_name` in `vite.config.ts` reads it. Don't hard-code the name anywhere else.
- **Instant open (ADR-004):** precache the app shell; render Today from IndexedDB first, then refresh in the background; optimistic check-offs with a queue flushed on open (no background sync on Safari); persist current screen and view toggle.
- **Navigation goes through `useNavigation()`** (`hooks/useNavigation.ts`). No router yet: the open screen is state, remembered in `localStorage`. Adding real URLs later means changing that hook and `App.tsx`, not the screens.
- **Keep logic out of components.** Components render; `domain/` and `hooks/` decide.
- **Click-through first:** screens call the same `api/` functions the real app will use; those return mock data unless the switch is on. Mock data follows `../docs/data-model.md` and the "Be fit / Be strong" example.
- **Mock or real is one build-time switch:** `VITE_API=real` (`npm run dev:real`, read in `api/mode.ts`) sends the functions already on the API to it; mock is the default. The functions keep their signatures either way, and only `api/request.ts` calls `fetch`.
- **API types are generated**, never hand-written: `npm run api:types` writes `src/api/openapi.ts` from `../api/openapi.json`; never edit it. `api/types.ts` names the generated types where the API has defined them (aspirations, goals, weekly targets, milestones, the goal's page and tasks, for now) and hand-writes the rest until their screens move. The mock stores some records differently from how the API sends them (`StoredGoal`, `StoredMilestone`, `StoredTask` (a task plus whether it's set aside) and check-ins as rows in `mockData.ts`) and builds what it returns the API's way. Regenerate after every API change.
- Test `domain/` with Vitest. Check layouts at iPhone width.
- Update `../docs/` in the same change when behavior changes.
