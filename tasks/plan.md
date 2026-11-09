# Implementation Plan: Today screen (#2)

Spec: [`../specs/002-today-screen.md`](../specs/002-today-screen.md). Tasks: [`todo.md`](todo.md). (The plan for #1 is in git history at `afa9830`.)

## Overview

Build the home screen: today's tasks in three groups, one-tap check-off with undo, a remembered List / By goal toggle, and working skip, swap and pull-from-bank against the mock store. Logic lives in `domain/today.ts` and `hooks/useToday.ts`; components only render.

## Dependency graph

```
Test tooling (RTL + jsdom)          domain/today.ts           api: bank functions
        │                                 │                          │
        └──────────────┬──────────────────┘                          │
                       ▼                                             │
        Today screen, read-only (List view) ──► check-off + undo     │
                       │                                             │
                       ├──► By goal view + remembered toggle         │
                       │                                             │
                       └──────────────► Pull from bank ◄─────────────┘
                                               │
                                               ▼
                                        Skip + Swap (⋯ menu)
                                               │
                                               ▼
                                     Docs + iPhone-width pass
```

Tasks 1, 2 and 5 have no dependencies on each other and could run in parallel; everything else is sequential because it all edits `useToday.ts` and `Today.tsx`.

## Architecture decisions

- **One hook, one screen state.** `useToday` owns the plan, the view and all actions. Optimistic updates replace the affected task in state, then call the client; on rejection they restore that task's previous value and set a calm message. A per-task request counter makes rapid taps settle on the last one.
- **Domain returns view models.** `groupForList(plan)` and `groupByGoal(plan)` return ready-to-render sections (`{ title, rows: { task, timeLabel?, subline? }[] }`), so components only map.
- **Weekday from the day string, not `new Date('YYYY-MM-DD')`** (that parses as UTC and can show the wrong day in the evening). Reuse `src/api/dates.ts` patterns; add a local-day parser in `domain/` if needed.
- **API-first for bank actions.** `getBank`, `skipTask`, `swapTask`, `pullFromBank` land together in one task so the contract is fixed before two UI slices use it. `uncheckTask` lands with the check-off slice.
- **View preference in `localStorage`**, key `gta.todayView`, wrapped in try/catch. IndexedDB arrives with #8 and may absorb it then.
- **jsdom only where needed.** Component and hook tests are `*.test.tsx` and run in jsdom; existing `*.test.ts` stay in Node. Configure per Vitest 5 docs (a `jsdom` project in `test.projects`, or a per-file environment comment if that's what the docs recommend).
- **Bank sheet is reused** for both Pull from bank and Swap (a "pick a bank task" sheet with an `onPick` callback).
- **No router.** `App.tsx` renders `<Today />`. Persisting the current screen comes with navigation (#3+ / #8).

## Phases

1. **Foundation:** test tooling, `domain/today.ts`. → Checkpoint: tests green.
2. **Core:** read-only List view, check-off with undo. → Checkpoint A: review on the phone.
3. **Views and bank:** By goal toggle, bank API, Pull from bank, Skip and Swap. → Checkpoint B: all spec criteria met.
4. **Wrap-up:** docs and polish. → Checkpoint C: PRs open.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RTL / jsdom friction with TypeScript 7, React 19.3 or Vitest 5 | Med | Task 1 first, with a smoke test; if it fights back, stop and report before building on it. |
| `@testing-library/react` needs `@testing-library/dom` as a peer: a 4th new package | Low | Called out in Task 1; confirm before installing. |
| Fake timers plus `userEvent` hang | Low | `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, or fix only the date with `vi.setSystemTime` and `shouldAdvanceTime`. |
| Optimistic race: tap, tap again before the first call settles | Med | Request counter per task; hook test covers it. |
| Wrong weekday or "today" late in the evening | Med | Local-day parsing; tests at 11:30 p.m., like #1. |
| Layout breaks at 375 px with long titles or the ⋯ menu | Low | Titles wrap, time label doesn't; manual check at 375 and 390 px in Task 8. |

## Verification

Every task: tests first, then `npm test && npm run lint && npm run build`, then one commit. The work stays on `today-screen-spec` (it holds the spec) and becomes one PR referencing #2; doc changes in the parent repo get their own branch and PR.

## Open questions

None. Settled in the spec's Decisions section.
