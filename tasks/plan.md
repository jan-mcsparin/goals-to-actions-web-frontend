# Implementation Plan: Week screen (#3)

Spec: [`../specs/003-week-screen.md`](../specs/003-week-screen.md). Tasks: [`todo.md`](todo.md). (The plan for #2 is in git history at `c22634f`.)

## Overview

Add the Week screen (progress and pacing, the days, the bank with "Put on a day"), turn Today into a Day screen that works for any date, and add a bottom tab bar whose current screen is remembered. Tasks the person places get `placedByHand`.

## Dependency graph

```
API: getDay + DayPlan rename ──► API: place on a given day + placedByHand ──┐
          │                                                                 │
          ▼                                                                 ▼
Day screen for any date ◄──────────────────────────────────────────────────┘
          │
          ├──► Fixed-day items have no menu
          │
          ▼
Navigation: tab bar + remembered screen (Week as a placeholder)
          │
API: getWeek + fuller mock week ──┐
domain/week.ts ───────────────────┼──► Week: progress + days (tap opens a day)
                                  │                  │
                                  └──────────────────┴──► Week: bank + Put on a day
                                                                  │
                                                                  ▼
                                                                Docs
```

Tasks 1, 6 and 7 don't depend on each other. Everything touching `Day.tsx`, `useDay.ts` or `App.tsx` is sequential.

## Architecture decisions

- **Rename, don't wrap.** `TodayPlan` becomes `DayPlan`, `getToday()` becomes `getDay(date)`, `useToday` becomes `useDay(date)`, `Today.tsx` becomes `Day.tsx`. No aliases are left behind; the rename is its own commit so behaviour changes stay reviewable.
- **One place function.** `pullFromBank(id, day = today)` serves Pull from bank on any day and the Week picker. `swapTask` places the bank task on the swapped task's `plannedDay`.
- **`placedByHand` is set by the API**, not the hook, so the rule lives where the future planner will read it. The hook's optimistic copy sets it too, so the screen matches.
- **Navigation state is a small union:** `{ screen: 'today' } | { screen: 'week' } | { screen: 'day'; date }`. It's persisted under `gta.screen` by `storage/navigation.ts` (same guarded pattern as `viewPreference.ts`) and exposed by `useNavigation()`. `App.tsx` picks the screen; screens receive `onOpenDay` / `onBack` callbacks rather than importing the hook. A router later replaces the hook's internals and `App.tsx` only.
- **Day screen for today vs another day:** `App` renders `<Day date={today} />` for the Today tab and `<Day date={date} onBack={...} />` for an opened day. The heading comes from `dayHeading(date, today)` in `domain/`.
- **Fixed-day rows:** `domain/today.ts` rows gain `fixed: boolean` (from the task's recurring item); `TaskRow` hides ⋯ when it's set.
- **Week view model in `domain/week.ts`:** `weekProgress(plan, today)`, `pacingLine(...)`, `daySummaries(plan, today)`, `weekRange(weekOf)`, `pickableDays(weekOf, today)`. `useWeek` loads `getWeek()` and maps through these.
- **Day-picker sheet** is a new component on the same native `<dialog>` pattern as `BankSheet`. Its markup is different enough (days, not tasks) that sharing one component would add conditionals.
- **Mock data:** new tasks only on Monday, Thursday, Friday and Saturday (relative to Monday). Today's tasks are untouched, so #2's tests (fixed to a Wednesday) keep their counts.

## Phases

1. **Any day:** getDay rename, place on a day + `placedByHand`, Day screen for any date, fixed-day rows. → Checkpoint A.
2. **Navigation:** tab bar and remembered screen. → Checkpoint B (on the phone).
3. **Week:** getWeek + mock week, `domain/week.ts`, progress and days, bank and picker. → Checkpoint C.
4. **Docs**, then the PRs. → Checkpoint D.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The rename touches 9 files and could hide a behaviour change | Med | Task 1 is a pure rename: no test changes other than names; diff reviewed alone. |
| Mock week additions collide with "today" on some real days (e.g. a Thursday task on a Thursday) | Low | Acceptable for the click-through; tests fix the date to a Wednesday. |
| Tab bar overlaps content or the home indicator | Med | Bottom padding = bar height + `env(safe-area-inset-bottom)`; check on the phone at Checkpoint B. |
| Persisted day from an old week reopens a stale date | Low | Restore it anyway (the Day screen works for any date); Week always shows the current week. |
| Date maths across month boundaries ("Nov 30–Dec 6") | Med | Use `dates.ts` helpers; explicit test. |
| Pacing copy drifting into pressure | Med | Wording fixed in the spec and tested verbatim. |

## Verification

Every task: tests first, then `npm test && npm run lint && npm run build`, then one commit. Work stays on `week-screen` and becomes one PR referencing #3; parent-repo docs get their own branch and PR.

## Open questions

None. Settled in the spec's Decisions section.
