# Spec: Mock data and API client (#1)

Status: approved 2026-11-09. Issue: [#1](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/1).

## Objective

Give the click-through screens realistic data through the same `src/api/` functions the real app will call. When the FastAPI backend exists, swapping the mock for real `fetch` calls (and hand-written types for generated ones) needs no screen changes.

This task lays the foundation: types for all seven entities, one coherent mock dataset, and the client pattern with two functions (`getToday`, `checkOffTask`) so the Today screen (#2) is unblocked. Each screen task adds the other functions it needs.

Out of scope: IndexedDB caching, the offline queue and optimistic UI (ADR-004, done in `storage/` and `hooks/`); planning logic such as grouping or the week draft (`domain/`); any screen.

## Tech stack

React 19, TypeScript 7, Vite 8, Vitest 5, oxlint. Node from `.nvmrc`. No new dependencies.

## Commands

```bash
nvm use
npm test          # vitest run
npm run lint      # oxlint
npm run build     # tsc -b && vite build (type-check)
```

## Project structure

```
src/api/
  types.ts         The seven entities + small shared types. Temporary; replaced by generated OpenAPI types.
  mockData.ts      The "Be fit / Be strong" dataset, dates relative to the current week. Imported only by mockStore.ts.
  mockStore.ts     In-memory copy of mockData that mutations change; reset() for tests.
  client.ts        Public async functions. The only module screens, hooks and domain/ may import (with types.ts).
  client.test.ts   Vitest tests for the client functions and dataset consistency.
```

## Data shapes

Field names and shapes follow `../docs/data-model.md`. Conventions, chosen to match what generated OpenAPI types will look like:

- Field names are camelCase. The API will emit camelCase too (Pydantic `alias_generator=to_camel`), so generated types match these and nothing changes on swap.
- IDs are strings.
- Dates are ISO strings: `'2026-11-09'` for a day, full ISO timestamp for instants (created, completed).
- Enums are string-literal unions (`erasableSyntaxOnly` rules out TS `enum`).
- Optional fields are `field?: T`, not `null`.
- Relations are by ID (`goalId`, `aspirationId`, `recurringItemId`), as a REST API would return them. Client functions that serve a screen may return a small composed shape (see below).

Sketch (not final):

```ts
export type TaskStatus = 'inBank' | 'planned' | 'done' | 'skipped'
export type TimeOfDay = { kind: 'by' | 'at'; time: string } // '07:00'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  weekOf: string              // Monday of the week it belongs to
  plannedDay?: string         // undefined while in the bank
  dueDate?: string
  timeOfDay?: TimeOfDay
  goalId?: string
  recurringItemId?: string
  valueLogged?: number
  rolloverCount: number
  completedAt?: string
}
```

Other entities: `Aspiration`, `Goal` (type `'building' | 'quitting' | 'oneOff'`, status `'active' | 'paused' | 'reached' | 'ended'`, baseline as text), `Milestone` (status `'upcoming' | 'hit' | 'notYet'`), `WeeklyTarget` (count/amount, unit, `effectiveFrom`), `RecurringItem` (repeat rule as text plus `fixedDay: boolean`), `Settings` (intensity `'easingOff' | 'normal' | 'goingHard'`, `weekStartsOn: 'monday'`).

## Client functions in this task

```ts
getToday(): Promise<TodayPlan>
checkOffTask(taskId: string, valueLogged?: number): Promise<Task>
```

- `TodayPlan` = `{ date, tasks, goals, aspirations, recurringItems }`: tasks whose `plannedDay` is today, plus the goals, aspirations and recurring items they reference, so the screen can show "Be strong · Be fit" without extra calls. Grouping into Keep life running / Move forward is left to `domain/` in #2. Free time is not a task type: it's the time tasks don't fill, so `Task` needs no field for it.
- `checkOffTask` sets `status: 'done'` and `completedAt`, stores `valueLogged` if given, and returns the updated task. A later `getToday()` reflects it until page reload. Unknown ID rejects with an `Error`.
- Functions return copies, so callers can't mutate the store by accident.
- No artificial latency by default.

## Mock dataset

Built relative to the current Monday so "today" always has data:

- Aspiration **Be fit**, with its why ("keep skiing, biking and playing hockey at a high level for decades").
- Building goal **Be strong**: measurable line bench 175 / squat 350 / deadlift 400, baseline 145 / 275 / 315; three milestones (one hit, one upcoming with a date, one without a date); weekly target 3 lifting sessions.
- A second aspiration with one goal (so Goals and "By goal" have more than one row).
- Recurring items: trash every Tuesday (fixed), laundry weekly (flexible), rent on the 1st (fixed).
- A week of tasks: some done on past days, 3–4 planned today (at least one timed "by", one timed "at", one untimed, one maintenance, one goal task), a few in the bank, one with `rolloverCount: 2` (for "Still matter?" later), one with no goal or recurring item ("Fill out my ballot", with a due date).
- Settings: intensity normal, week starts Monday.

## Code style

Matches the repo: no semicolons, single quotes, 2-space indent, `.ts` extensions in imports, named exports, small functions.

```ts
import { store } from './mockStore.ts'
import type { Task, TodayPlan } from './types.ts'

export async function getToday(): Promise<TodayPlan> {
  const date = toIsoDay(new Date())
  const tasks = store.tasks.filter((task) => task.plannedDay === date)
  return structuredClone({ date, tasks, ...relatedTo(tasks) })
}
```

## Testing strategy

Vitest, `src/api/client.test.ts`, store reset before each test, system time faked so "today" is fixed.

- `getToday` returns only today's tasks plus exactly the goals, aspirations and recurring items they reference.
- `checkOffTask` marks done, sets `completedAt`, stores a value, is visible to the next `getToday`, and rejects an unknown ID.
- Dataset consistency: every `goalId`, `aspirationId`, `recurringItemId` and milestone/target `goalId` points at a real record; every task's `weekOf` is a Monday.
- Returned objects are copies (mutating them doesn't change the store).

## Boundaries

- **Always:** keep everything outside `src/api/` off `mockData.ts` / `mockStore.ts` (enforced by oxlint `no-restricted-imports`); run test, lint and build before commit; keep types aligned with `../docs/data-model.md` and update the doc if they diverge.
- **Ask first:** adding a dependency (e.g. a date library); adding fields not in the data model.
- **Never:** put planning logic (grouping, drafting, pacing) in `api/`; hand-edit types after generation exists.

## Success criteria

- [ ] `types.ts` covers all seven entities from the data model.
- [ ] The mock dataset matches the list above and passes the consistency test.
- [ ] `getToday` and `checkOffTask` behave as described and are tested.
- [ ] No module outside `src/api/` imports `mockData.ts` or `mockStore.ts`, and oxlint fails if one does.
- [ ] `npm test`, `npm run lint` and `npm run build` pass.

## Decisions

1. **camelCase JSON** across the contract; the API will alias Pydantic fields to camelCase.
2. **Quitting goals** (daily yes/no log, urge ratings) are omitted for now; added when a screen needs them.
3. **Import boundary** enforced with oxlint `no-restricted-imports`.
4. **Free time** is the time tasks don't fill, not a group of tasks.

## Plan

`tasks/plan.md` and `tasks/todo.md` as of commit `afa9830` (since replaced by the next issue's plan).
