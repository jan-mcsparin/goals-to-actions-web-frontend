# Implementation Plan: Setup screens on the API (#41)

Spec: [`../specs/041-setup-screens-on-api.md`](../specs/041-setup-screens-on-api.md). Tasks: [`todo.md`](todo.md). (The plan for #40 is in git history at `b3154a8`.)

## Overview

First, a small API change makes the reads match the screens. Then the front end moves goals, weekly targets, milestones and check-ins onto the generated types, in the mock first, so the click-through still looks the same. Next, its client functions follow the API one for one. Last, the real versions go behind the switch. With `VITE_API=real`, the Aspirations tab, an aspiration's page, a goal's page and the Add sheet's goal form all run on a local API.

There are two PRs:

1. **API repo:** `goal-reads-for-the-screens`, with its own issue.
2. **Front end:** `setup-screens-on-api`. It closes #41 and #33, and is "Part of #32".

## Settled with Jan, 2026-11-18

1. **`listGoals` gives each goal its `progress`** (`{ hit, of }`). The tab and an aspiration's page take their counts from it.
2. **#33 goes in whole; #32 as data shape only.** The UI makes count targets only: `kind: 'count'`, with `sessions` taking the number the form has called `amount`.
3. **One client function per API operation**, mock and real alike.
4. **The goal page names its aspiration:** `aspiration: { id, name } | null`.
5. **Each milestone on the goal page carries `result`:** the result of its latest hit check-in, or `null`. The timeline keeps showing "Hit · Bench 150", and #33's "nothing changes on screen" holds.

## Dependency graph

```
API: progress on listed goals, aspiration on goal page, result on milestones ──► openapi.json
                                                                                     │
                                                                  npm run api:types ─┘
                                                                         │
          Goal + WeeklyTarget generated (mock, domain, hooks) ◄──────────┘
                     │
          ┌──────────┴───────────┐
          ▼                      ▼
  tab/aspiration counts    goal page = GoalPage, check-ins as records (#33)
  from goal.progress                     │
          └──────────┬───────────────────┘
                     ▼
     client functions one per operation (mock); useGoal uses what writes return
                     │
                     ▼
     realGoals.ts behind the switch; real tab and aspiration reads add listGoals
                     │
                     ▼
     manual check against a local API ──► docs, PR
```

Tasks 3 and 4 both need Task 2, and neither needs the other.

## Architecture decisions

- **API change, in the API repo.**
  - `listGoals` returns `ListedGoal`, which is `Goal` plus `progress`. A new sqlc query counts each goal's milestones and hits in one statement.
  - The `hit + reached` / `of = n + 1` rule moves to one function, used by the page and by the list.
  - `GoalPage` gains `aspiration: AspirationRef | null`, holding `id` and `name`.
  - `Milestone` on the page gains `result`, taken from its latest `hit` check-in.
  - Only reads change, so nothing queueable changes either (shared decision 14). `openapi.json` is regenerated. `goals-targets.md` and `milestones-check-ins.md` describe the new fields.
- **No `Goal` record type is hand-written.**
  - `Goal`, `WeeklyTarget`, `NewGoal`, `Milestone`, `GoalPage` and `ListedGoal` are named from `components['schemas']`.
  - `AspirationsOverview` and `AspirationDetail` hold `ListedGoal[]`. Their `milestones` and `weeklyTargets` arrays go, because each goal now carries its target and progress.
  - `recurringItems` and `weekTasks` stay hand-written until #42.
- **The mock keeps check-ins as rows** (`store.checkIns`), the way the API does. `latest` and each milestone's `result` are worked out from those rows when the page is read, with the same rules as the API.
- **The mock follows the API's rules for the routes it gains:**
  - Only Next can be checked in, and a hit on the goal's own line marks the goal reached.
  - Reopen and Go again are their own functions.
  - A later date pushes later dated milestones out (`pushedDates` already does this).
- **Every milestone and check-in write returns the goal's page.** `useGoal` keeps its optimistic change and puts the page that comes back in its place. Pause, resume, end and the rest return the goal, so the hook reloads the page after them, as it does now.
- **Real functions go in `src/api/realGoals.ts`,** beside `realAspirations.ts`. Each one opens with `if (realApi) return real.x(...)` in `client.ts`, as in #40. The real `getAspirations` and `getAspiration` read `listAspirations` and `listGoals` side by side.
- **Ids made on the device** (`newDeviceId`) for goals, milestones and check-ins, in mock and real.
- **`slipped` is carried and not shown** until #36.

## Phases

1. **API reads.** API PR merged; types regenerated. → Checkpoint 1.
2. **Front end on the generated shapes, mock only.** Goal and target types; counts from progress; the goal page and check-ins; client functions one per operation. → Checkpoint 2: the suite is green, every screen looks as it did, and the build fails if the mock drifts.
3. **Real.** Real functions, the switch, and a manual check against a local API. → Checkpoint 3: docs updated and the PR opened.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Task 2 ripples through many files (types, mock, four domain modules, two hooks, tests) | High | Names and shapes only, no behaviour. Any assertion that changes beyond a fixture or name is listed in the commit. If it grows past ~10 files, split the target shape out. |
| `null` in place of left-out fields breaks `!== undefined` checks quietly | Med | Grep for `=== undefined` and `!== undefined` on goal, target and milestone fields. Add domain tests with `null` baseline, deadline and target date. |
| Week and Today pacing read `weeklyTargets` by `goalId` | Med | They get the target from the goal (`goal.weeklyTarget`). Today and Week stay on mock, but their tests run through Task 2. |
| `goal.weeklyTarget` is the latest target, not this week's (spec open question 5) | Low | Bars are empty in real mode until #42. The mock only ever sets this week's target. |
| A one-off goal's step add fails in real mode | Low | Accepted in the spec. It shows the usual failed-save message until #31. |
| The API PR waits on review | Low | Phase 2 runs on mock and needs only the regenerated types. Task 2 can start from the API branch's `openapi.json`. |

## Open questions

- Spec open question 5 (which week's target the bars use) stays assumed for #42.
