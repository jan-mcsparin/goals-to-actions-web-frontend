# Implementation Plan: Aspirations tab (#4)

Spec: [`../specs/004-aspirations-tab.md`](../specs/004-aspirations-tab.md). Tasks: [`todo.md`](todo.md). (The plan for #3 is in git history at `79f2be7`; #2's at `c22634f`.)

## Overview

Add the third tab. It shows each active aspiration as a card in priority order (why, this week's count, goals with milestone or step progress, recurring items), then Other goals, a Keep life running row and Retired. Cards, goal rows and the Keep life running row open their own screens: placeholders for an aspiration and a goal (#13 and #5 fill them), and a real, show-only Keep life running page. The open screen is remembered, as before.

## Dependency graph

```
Mock dataset grows (status, new goals, milestones, items) ──► getAspirations ──┐
        │                                                                      │
        │                         Navigation: third tab + new screens ─────────┤
        │                                                                      │
        │        domain/aspirations: cards, goal rows ──► week count,          │
        │                                                 below the cards      │
        │                                   │                   │              │
        │                                   ▼                   ▼              ▼
        │                         Aspirations screen: cards ──► below the cards
        │                                                           │
        │                                                           ▼
        │                                     Open an aspiration or a goal (placeholders)
        │
        └──► getUpkeep + domain/upkeep ──► Keep life running page (needs navigation)
                                                        │
                                                        ▼
                                                   Docs, then the PR
```

Tasks 3, 4–5 and 9 don't depend on each other once Task 1 is in. Everything touching `App.tsx` (3, 8, 10) is sequential.

## Architecture decisions

- **The mock grows first, alone.** It's the only step that changes existing tests (Week's second progress row, one more bank task), so it gets its own commit before anything new is built on it.
- **`getAspirations()` returns records, not a view.** Ordering, grouping and counting live in `domain/aspirations.ts`. It reuses `currentTarget` for "the target in force this week".
- **Navigation grows as the spec's union:** `aspirations`, `aspiration` (with `aspirationId`), `upkeep`, `goal` (with `goalId` and `from`). `from` is `{ screen: 'aspirations' } | { screen: 'aspiration'; aspirationId }`, validated on read; anything malformed falls back to Today. `tabOf(screen)` in `storage/navigation.ts` says which tab a screen counts as, so `App.tsx` stops deciding that inline.
- **Screens still take callbacks** (`onOpenAspiration`, `onOpenGoal`, `onOpenUpkeep`, `onBack`), not the hook, as Week does.
- **The week count is its own function** (`weekCount` in `domain/aspirations.ts`), not `weekProgress` reused: it sums across goals and caps each at its target, and has no pacing.
- **Collapsed sections use native `<details>`** ("Past goals (2)", "Retired (1)"). No state, no dependency, keyboard and VoiceOver work for free. Whether they're open isn't remembered.
- **A card is not one big button.** The card top (name, chevron, why) is a button and each goal row is a button, as siblings, so the two targets never nest.
- **Placeholders look names up through `useAspirations()`.** An id that no longer exists shows just the back link. #13 and #5 replace these files.
- **The Keep life running row's count comes from the overview** (active recurring items with no aspiration), so the tab makes one request. The page uses `getUpkeep()`.
- **To-do rows say where the task sits** via `whereLabel(task, today)` in `domain/upkeep.ts`: a weekday, "In the bank", or "Week of Nov 23". The mock has no later-week task (the mock-data test keeps every task in this week), so that case is covered in the domain test with a hand-built task.

## Phases

1. **Data:** the mock grows, `getAspirations`. → Checkpoint A.
2. **Navigation:** third tab and the new screens, remembered. → Checkpoint B (on the phone).
3. **The tab:** domain, cards, below the cards, opening an aspiration or goal. → Checkpoint C.
4. **Keep life running:** `getUpkeep`, `domain/upkeep.ts`, its page. → Checkpoint D.
5. **Docs**, then the PR. → Checkpoint E.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The spec says #2's tests stand, but the new bank run shows in Today's bank sheet (`Day.test.tsx` expects 3 list items) | Low | One count changes from 3 to 4 in Task 1. Today's own tasks are untouched. See open question 2. |
| Mock changes ripple into Week and client tests | Med | Task 1 is mock-only; every changed expectation is listed in its commit. |
| Three tabs now, four with the + in #6: labels crowd at 375 px | Med | Check on the phone at Checkpoint B with the longest label. |
| Card top and goal rows are hard to hit apart | Med | 44 px minimum row height, visible separation; checked at Checkpoint C. |
| Long goal labels push the count off screen | Med | Label wraps, count doesn't shrink (`flex: none`); a long label in the screen's manual check. |
| A remembered aspiration or goal id no longer exists | Low | Placeholder shows the back link only. |
| Count wording drifts toward pressure | Med | Strings come from the spec and are tested verbatim; no pacing on this screen. |

## Verification

Every task: tests first, then `npm test && npm run lint && npm run build`, then one commit. Work stays on `aspirations-tab` and becomes one PR referencing #4. If the parent repo's docs need a fix, that's its own branch and PR.

## Open questions

None. Settled with Jan on 2026-11-10:

1. **Where a recurring item belongs is the person's call**, so the click-through shows both: Trash and Laundry stay under "Keep a calm home" (its card reads "2 recurring: Take out the trash, Laundry"), and Pay rent has no aspiration, so it's on the Keep life running page. The mock's three items stay as they are.
2. **`Day.test.tsx` changes by one number** (bank sheet: 3 → 4 items) because of the new bank run. No task on today changes.
