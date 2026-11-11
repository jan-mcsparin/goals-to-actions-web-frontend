# Implementation Plan: Aspiration page (#13)

Spec: [`../specs/013-aspiration-page.md`](../specs/013-aspiration-page.md). Tasks: [`todo.md`](todo.md). (The plan for #4 is in git history at `f87a231`; #3's at `79f2be7`; #2's at `c22634f`.)

## Overview

Replace #4's placeholder with the aspiration's page: its why, this week's count with days left, a card per goal (active, then paused), its recurring items, past goals collapsed, and its place in priority. Then the managing, only when tapped: edit the name and why, move up or down, review, retire (pause its work or keep it going), and, on a retired aspiration's page, bring it back. Everything runs against the mock, and the tab, Week and Today follow.

## Dependency graph

```
getAspiration + AspirationDetail ──► domain/aspiration.ts ──► useAspiration ──► Aspiration screen (show only)
        │                                                           │                    │
        ▼                                                           │                    ▼
update / review / move / bringBack ─────────────────────────────────┤        ┌── Reorder (Priority section)
        │                                                           │        ├── Edit sheet
        ▼                                                           │        ├── Retire sheet ──┐
retireAspiration (pause | keep), getDay leaves out skipped ─────────┘        │                  ▼
                                                                             │            Review sheet (needs Edit, Move, Retire)
                                                                             └── Retired page + Bring back
                                                                                            │
                                                                                            ▼
                                                                                       Docs, then the PR
```

Tasks 1–3 are API only and sequential (one file). Tasks 6, 7 and 8 don't depend on each other once 5 is in; Review (9) needs all three. Everything touching `App.tsx` (5, 8) is sequential.

## Architecture decisions

- **Only active aspirations have a priority, and it's their position** (Jan, Nov 10). `Aspiration.priority` becomes optional; active ones are numbered 1…n with no gaps. Retiring clears it and closes the gap; bring back sets `activeCount + 1`. So "1st of 2" is `priority` of `activeCount`, and `AspirationDetail` needs nothing extra. The mock's Speak Spanish loses `priority: 3`.
- **Set-aside tasks keep their day.** Retiring with "Pause them" sets this week's not-done tasks for those goals and recurring items to `skipped` and leaves `plannedDay` alone (history is kept). `getDay` leaves out `skipped` tasks; Week's day lines, the bank and Keep life running already only show planned, done or in-bank tasks, which tests confirm.
- **Moving swaps two numbers.** `moveAspiration` swaps `priority` with the neighbour one up or down; with no gaps and no retired ones in the numbering, there's nothing to skip.
- **Reuse #4's domain.** `goalProgress`, `progressLabel` and `weekCount` take `Pick<…>` of the records they read, so `AspirationDetail` fits. `domain/week.ts` exports `daysLeft(weekOf, today)`, which Week's pacing already computes inline.
- **The page is one view object.** `aspirationPage(detail, today)` returns `{ kind: 'active', … } | { kind: 'retired', … }`, so the screen can't show Priority or Edit on a retired page by mistake.
- **History line:** "Since October: 1 goal reached, 3 goals active, 2 recurring items." Active means status active (not paused); recurring means active items. The year is added when it isn't this year ("Since March 2025").
- **Goal card week line** uses the target's unit: "This week: 1 of 3 lifting sessions", done not capped, as on Week's progress row.
- **Optimistic where it's instant to undo.** Edit, move and review update the page at once and roll back with "Couldn't save that. Try again." Retire and bring back wait for the save (rare, and retire leaves the page), then act; a failure shows the same message and stays put.
- **Sheets are their own components** (`AspirationEditSheet`, `ReviewSheet`, `RetireSheet`) on the native `<dialog>` pattern (`useModalDialog`, `sheet.css`). The page holds one `openSheet` state (`'edit' | 'review' | 'retire' | undefined`), so Review's choices just switch it, and nothing is open on first render.
- **"Move it"** closes the Review sheet, scrolls the Priority section into view and focuses its heading (`tabIndex={-1}`).
- **Not found goes back quietly.** `useAspiration` reports `notFound` when `getAspiration` rejects for an unknown id; the screen calls `onBack()` (which saves Aspirations as the open screen). Other load failures show the usual message.
- **Retired aspiration's goals keep their aspirationId** when paused, so they still list on its page. Whether one can be resumed on its own is #5's call (Jan, Nov 10).

## Phases

1. **API:** `getAspiration`, the simple mutations, `retireAspiration`. → Checkpoint A.
2. **The page, shown:** domain, hook, screen. → Checkpoint B (on the phone).
3. **Managing:** reorder, edit, retire, review, bring back. → Checkpoint C.
4. **Docs**, then the PR. → Checkpoint D.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Skipped tasks still show somewhere (Today, Week's days, bank, progress, Keep life running) | High | Task 3 tests each read after a "pause" retire; `getDay` filter added there. |
| The mock store is shared across tests, so a retire in one test leaks | Med | `resetStore()` in `beforeEach` for every new test file, as the client tests do. |
| Retire sheet doesn't fit at 375 px (history, two choices with lines, note, two buttons) | Med | Compact radio rows; checked on the phone at Checkpoint C. |
| Optimistic move and a fast second tap race | Low | Buttons follow the optimistic position; the newest request wins, as in `useDay`. |
| Wording drifts toward judgment ("abandon", "give up") | Med | Strings come from the spec and are tested verbatim. |
| Reorder doesn't reach Week or Today | Low | They load on mount and already sort by priority; App test covers the tab, and the manual check covers Week and Today. |

## Verification

Every task: tests first, then `npm test && npm run lint && npm run build`, then one commit. Work stays on `aspiration-page` and becomes one PR referencing #13. A parent-repo doc change, if any, is its own branch and PR.

## Open questions

None. Settled with Jan on 2026-11-10:

1. **Resuming a goal whose aspiration is retired** is decided in #5. This page only lists those goals and opens them.
2. **Retired aspirations have no priority**; active ones are numbered without gaps.
3. **Set-aside tasks keep their day; retire and bring back wait for the save; the history line adds the year only when it isn't this year.**
