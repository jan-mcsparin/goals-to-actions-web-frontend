# Implementation Plan: Today, Week and the bank on the API (#42)

Spec: [`../specs/042-plan-screens-on-api.md`](../specs/042-plan-screens-on-api.md). Issue: [#42](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/42). Tasks: [`todo.md`](todo.md). (The plan for #39 is in git history.)

## Overview

The plan screens move to the API in two PRs. First the API's week read gains what Today and Week need (API #45), so Today stays one read. Then the front end, in ten commits: the mock takes on the API's `Week` shape, Today and the bank are drawn from it, and then each group of actions goes to the real API behind the switch. Mock stays the default throughout, and looks the same at every commit.

## Architecture decisions

- **Shape first, then wiring.** Tasks 1 to 5 change only shapes and reads, on mock, with nothing on screen changing. That's the riskiest part (useDay is the biggest hook, and every plan test touches the week's shape), so it goes first and is checked before any real call is added.
- **`getDay` and `getBank` go; `dayOf` and `bankOf` draw from the week** (ADR-010). `useDay` reads the day's week once; the bank sheet is drawn from that same week, not loaded separately. #43 then stores that document and changes nothing here.
- **`realPlan.ts` beside `realGoals.ts`**, one function per operation; `client.ts` picks mock or real per function, as now.
- **The tab's bars read the week's `goals[].progress`**, in mock and real. `AspirationsOverview.weekTasks` and `AspirationDetail.weekTasks` become the current week's goals. The target in force that week comes with them (041's assumed decision 6).
- **The mock works out `aspiration` and `fixedDay` when it sends a task**, as it already does `atClose`, stored empty like `atClose`, so `mockData.ts`'s rows don't change.
- **The mock keeps its stand-ins** for the server until #43 (spec decision 2), but builds what it returns as the API's `Week`.

## Dependency graph

```
API #45 (aspiration + fixedDay on tasks and week goals)
 └── 1 Tasks carry aspiration and fixedDay (mock works them out)
      └── 2 The mock sends the API's Week; Week reads it
           ├── 3 Today's sections drawn from a week (dayOf, bankOf)
           │    └── 4 useDay reads the week
           │         └── 5 getDay and getBank go
           │              ├── 6 Plan actions on the real API
           │              │    └── 7 Adding a task sends a day
           │              └── 8 Recurring items and Keep life running on the real API
           └── 9 Tab bars from the week's goals
                          └── 10 Docs, CLAUDE.md, manual checks, PR (after 6 to 9)
```

6, 8 and 9 only share `client.ts`; they run in order to keep each commit small, not because one needs another.

## Task list

### Phase 0: the API (its own PR, in `api/`)
- [x] Task 0: The week read names aspirations and fixed days (API #45)

### Phase 1: the week's shape, on mock
- [x] Task 1: Tasks carry their aspiration and fixed day
- [x] Task 2: The mock sends the API's `Week`
- [x] Task 3: Today's sections drawn from a week
- [x] Task 4: `useDay` reads the week
- [ ] Task 5: `getDay` and `getBank` go

### Checkpoint A
- [ ] Tests, lint, build pass; on mock, Today, a day, Week, the bank sheet and wrap-up look and work as before (Sonnet agent, phone width)

### Phase 2: the real API
- [ ] Task 6: Plan actions on the real API
- [ ] Task 7: Adding a task sends a day
- [ ] Task 8: Recurring items and Keep life running on the real API
- [ ] Task 9: The tab's bars from the week's goals

### Checkpoint B: complete
- [ ] Task 10: Docs, then manual checks on real and mock, then the PR

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `useDay` rework breaks the optimistic save and rollback | High | Task 4 keeps `useDay`'s existing tests passing unchanged in what they assert; only fixtures move to the `Week` shape |
| The local API has no next week open or no "Still matter?" task, so those can't be checked by hand on real | Med | The agent checks what the date allows and says what it couldn't; those paths are covered by `realPlan` tests and the mock |
| A task due beyond the open weeks has `week: null`; screens that assume a week mislabel it | Low | `taskConfirmation` and Keep life running's `whereLabel` get a case for it, with tests |
| The tab and an aspiration's page grow to four reads | Low | Run side by side (`Promise.all`); reading them once is #43's |

## Open questions

None. All four of the spec's were settled on 2026-11-20.
