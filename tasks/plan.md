# Implementation Plan: Mock data and API client (#1)

Spec: [`specs/001-mock-api-client.md`](../specs/001-mock-api-client.md). Issue: [#1](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/1). Branch: `mock-api-client`, one PR.

Tasks are tracked in [`tasks/todo.md`](todo.md). They are steps inside issue #1, so they don't get their own GitHub issues.

## Overview

Build `src/api/`: the seven entity types, a coherent "Be fit / Be strong" mock dataset, an in-memory store, and the first two client functions (`getToday`, `checkOffTask`). Screens import only `client.ts` and `types.ts`, and the linter enforces it.

## Dependency graph

```
types.ts (Task, Goal, Aspiration, RecurringItem, TimeOfDay, TodayPlan)
    │
    ├── mockData.ts (today's tasks + what they reference)
    │       │
    │       └── mockStore.ts (copy + reset)
    │               │
    │               ├── client.getToday ──── Today screen (#2) can start
    │               └── client.checkOffTask
    │
    └── remaining types (Milestone, WeeklyTarget, Settings) + rest of the dataset
            └── dataset consistency test

.oxlintrc.json boundary rule ─ independent, needs mockData/mockStore to exist
../ docs updates ─ independent (parent repo)
```

## Architecture decisions

- **Vertical slices:** each task ends with a working, tested client function or a complete dataset, not a layer of types with nothing using them. Task 1 builds only the types and data `getToday` needs; Task 3 fills in the rest.
- **The store is a module-level object** with `reset()`, deep-cloned from `mockData` and cloned again on the way out. No class and no async simulation. Swapping in real `fetch` calls later changes only `client.ts`.
- **Dates are local `YYYY-MM-DD` strings** built from `Date` parts by a small helper in `src/api/` (the only date code in this task). If `domain/` needs the same helper later, it moves there.
- **camelCase, string IDs, string-literal unions, optional fields as `?:`** (spec, Data shapes).

## Task list

Order and checkpoints only; tick boxes in [`todo.md`](todo.md).

1. `getToday` returns today's tasks with what they reference
2. `checkOffTask` marks a task done
   - **Checkpoint A:** review; Today (#2) can start
3. Remaining types and the full week's dataset
4. Lint rule for the mock-data boundary
   - **Checkpoint B:** spec success criteria met; open the web-frontend PR
5. Record the decisions in the parent docs
   - **Checkpoint C:** parent-repo PR open

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| UTC vs local date: `toISOString()` gives the wrong day near midnight | High: Today shows the wrong tasks | Local date helper; tests fake system time, including a late-evening time |
| oxlint's `no-restricted-imports` may not support patterns plus a per-folder override | Low | Check in Task 4. Fallback: a Vitest test that scans `src/` for forbidden imports (no new dependency) |
| Mock data generated "relative to this week" changes per run and makes tests flaky | Medium | Data is built by a function of a reference date; tests fix the date |
| Hand-written types drift from the future generated ones | Medium | Follow the spec conventions; the camelCase decision is recorded in Task 5 |

## Open questions

None blocking.
