# CLAUDE.md: goals-to-actions-web-frontend

The front end for Goals to Actions. Product context, rules and ADRs live in the parent folder (`../CLAUDE.md`, `../docs/`). Read `../docs/product-rules.md` before planner or UI work.

## Stack

React + Vite + TypeScript, client-rendered, no SSR. PWA via vite-plugin-pwa (manifest + service worker) from the start. Mobile-first; must also work on a laptop.

## Structure

```
src/
  config.ts        APP_NAME and other product constants (the only place the name appears in code)
  api/             API client functions + types (generated from the OpenAPI schema once the API exists)
  domain/          plain TS: planning, pacing, rollover rules. No React imports. Unit-tested.
  storage/         IndexedDB cache of the last-known plan + offline change queue
  hooks/           React hooks wrapping api/, domain/ and storage/
  screens/         Today, Week, Goals, GoalDetail, Add, Settings
  components/      presentational pieces only
```

## Rules

- **Product name in one place:** `src/config.ts` exports `APP_NAME`; the PWA manifest `name`/`short_name` in `vite.config.ts` reads it. Don't hard-code the name anywhere else.
- **Instant open (ADR-004):** precache the app shell; render Today from IndexedDB first, then refresh in the background; optimistic check-offs with a queue flushed on open (no background sync on Safari); persist current screen and view toggle.
- **Keep logic out of components.** Components render; `domain/` and `hooks/` decide.
- **Click-through first:** screens call the same `api/` functions the real app will use; those return mock data until the API exists. Mock data follows `../docs/data-model.md` and the "Be fit / Be strong" example.
- **API types are generated**, never hand-written, once `api/` exists.
- Test `domain/` with Vitest. Check layouts at iPhone width.
- Update `../docs/` in the same change when behavior changes.
