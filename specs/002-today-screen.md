# Spec: Today screen (#2)

Status: approved 2026-11-09. Issue: [#2](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/2). Depends on #1 (done).

## Objective

Today is the home screen, opened many times a day on an iPhone. In one glance it shows the day's plan; in one tap it marks a task done. It also lets the person change today on purpose: skip a task, swap it for one from the bank, or pull extra work in. Nothing on Today changes unless the person did it.

References: [Flow 4](../../docs/flows.md#flow-4-plan-today), [Flow 5](../../docs/flows.md#flow-5-do-and-check-off), [ADR-004](../../docs/adr/0004-instant-open.md), [`today.png`](../../docs/screens/today.png), [screens README](../../docs/screens/README.md#today-home-screen), [product rules](../../docs/product-rules.md).

### What the person sees

- **Header:** "Today · Tuesday" and "1 of 4 done", with a progress bar.
- **View toggle:** List (default) / By goal. The choice survives reloads and iOS restarts.
- **List view:** three groups in order:
  - **Keep life running:** tasks from a recurring item, and tasks with neither goal nor recurring item ("Fill out my ballot").
  - **Move forward:** goal tasks, each with a subline "Be strong · Be fit" (goal · aspiration; goal alone if it has no aspiration).
  - **Free time:** one warm line, no tasks: "The rest is yours."
- **By goal view:** a card for Keep life running, then one card per goal titled "Be strong · Be fit", ordered by aspiration priority. Free time line below the cards.
- **Order within a group:** timed tasks first, by time; untimed tasks after, in plan order. Labels: `by` → "by 7 a.m.", `at` → "at 6 p.m.", `:00` dropped, otherwise "at 6:30 p.m.".
- **Check off:** tap the circle or the row. It turns done immediately. Tap again to undo.
- **Per-task actions:** Skip (back to the bank) and Swap (pick a bank task to take its place) from a small row menu. No swipe gestures in this task.
- **Pull from bank:** button at the bottom opens a sheet listing this week's bank tasks; tapping one puts it on today.
- **Empty day:** no tasks planned → a warm line and the Pull from bank button. No progress bar.
- **Copy:** warm, never judgmental. No "overdue", no counts of what's left undone beyond "N of M done".

### Progress rule

"N of M done" counts today's tasks with status `done` over today's tasks with status `planned` or `done`. Skipped tasks leave today, so they leave the count.

## Scope

**In:**
- `domain/today.ts`: grouping, ordering, time labels, progress, goal subline. Pure functions.
- `api/client.ts`: `uncheckTask`, `getBank`, `skipTask`, `swapTask`, `pullFromBank` against the mock store, plus mock data if needed.
- `hooks/useToday.ts`: loads the plan, applies optimistic changes, rolls back on error.
- `storage/viewPreference.ts`: remembers List / By goal in `localStorage`.
- `screens/Today.tsx` and small presentational components; `App.tsx` renders Today.
- React Testing Library + jsdom (new dev dependencies, approved 2026-11-09).

**Out (later issues):**
- IndexedDB last-known plan, offline queue, service worker precache → #8.
- Reflowing the rest of the week after a change (planner work).
- Quick value entry on check-off ("how many miles"), pacing line ("2 of 3 lifting sessions") → Week (#3) or later.
- "Still matter?" prompt, overload warnings, swipe gestures, navigation between screens.

## API additions

All in `src/api/client.ts`, same pattern as #1: async, return copies, reject unknown IDs with an `Error`.

```ts
uncheckTask(taskId: string): Promise<Task>
// status 'done' → 'planned'; clears completedAt and valueLogged.

getBank(): Promise<BankTask[]>
// This week's tasks with status 'inBank', plus the goal/aspiration/recurring item they reference
// (same composed shape as TodayPlan, so the sheet can show sublines).

skipTask(taskId: string): Promise<Task>
// status → 'inBank', plannedDay cleared. Not counted as a rollover.

swapTask(taskId: string, bankTaskId: string): Promise<{ skipped: Task; placed: Task }>
// skipTask(taskId) + pullFromBank(bankTaskId), atomically. Each task keeps its own timeOfDay.

pullFromBank(bankTaskId: string): Promise<Task>
// status 'inBank' → 'planned', plannedDay = today. Rejects if the task isn't in the bank.
```

Exact return shape of `getBank` is settled in the plan; it must match what a REST endpoint would plausibly return.

## Optimistic updates (ADR-004, light part)

- `useToday` exposes `plan`, `view`, `setView`, and actions `toggleDone`, `skip`, `swap`, `pull`.
- Each action updates local state first, then calls the client. On rejection it restores the previous state for that task and shows a short, calm message ("Couldn't save that. Try again.").
- Rapid double taps on the same task settle on the last tap's state.
- The hook holds no planning rules; it calls `domain/` for derived data.

## Tech stack

React 19, TypeScript 7, Vite 8, Vitest 5, oxlint. Node 24 (`.nvmrc`). New dev deps: `@testing-library/react`, `@testing-library/user-event`, `jsdom` (exact versions pinned in the plan; Vitest `environment: 'jsdom'` only for `*.test.tsx`).

## Commands

```bash
nvm use
npm test          # vitest run
npm run lint      # oxlint
npm run build     # tsc -b && vite build
npm run dev       # check at iPhone width (390 × 844) in devtools
```

## Project structure

```
src/
  api/client.ts            + uncheckTask, getBank, skipTask, swapTask, pullFromBank
  api/types.ts             + BankTask (or equivalent composed shape)
  domain/today.ts          groupToday, orderTasks, timeLabel, progress, goalSubline
  domain/today.test.ts
  storage/viewPreference.ts  read/write 'list' | 'byGoal'; tolerates missing/blocked storage
  storage/viewPreference.test.ts
  hooks/useToday.ts
  hooks/useToday.test.tsx
  screens/Today.tsx
  screens/Today.test.tsx
  components/TaskRow.tsx, ProgressHeader.tsx, ViewToggle.tsx, BankSheet.tsx (names may shift in the plan)
  App.tsx                  renders <Today />
```

## Code style

Match the repo: no semicolons, single quotes, 2-space indent, `.ts`/`.tsx` extensions in imports, named exports, small functions. Components render only.

```ts
// domain/today.ts
export function timeLabel({ kind, time }: TimeOfDay): string {
  return `${kind} ${formatClock(time)}` // 'by 7 a.m.', 'at 6:30 p.m.'
}
```

```tsx
// components/TaskRow.tsx
export function TaskRow({ task, subline, onToggle }: TaskRowProps) {
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={task.status === 'done'} onClick={onToggle}>
        {task.title}
      </button>
      {subline && <p>{subline}</p>}
    </li>
  )
}
```

## Accessibility and layout

- Works at 375 and 390 px wide, no horizontal scroll; tap targets ≥ 44 px.
- Check-off is a real checkbox semantics (`role="checkbox"`, `aria-checked`) with the task title as its name.
- Toggle is a two-option segmented control with `aria-pressed` (or radio group).
- Respects iPhone safe areas (`env(safe-area-inset-*)`).
- Done state is not shown by color alone (check mark + strikethrough or dimmed).

## Testing strategy

- **`domain/today.test.ts` (Vitest):** grouping incl. no-goal tasks; timed-before-untimed ordering; time labels (7:00, 18:00, 18:30, 12:00, 00:00); progress ignores skipped; subline with and without aspiration.
- **`api/client.test.ts`:** each new function's happy path, unknown-ID rejection, state visible to the next `getToday`/`getBank`, copies returned; `swapTask` leaves the store unchanged if either ID is invalid.
- **`storage/viewPreference.test.ts`:** default `list`; round-trip; storage that throws falls back to default.
- **`hooks/useToday.test.tsx` (RTL):** optimistic toggle shows before the client resolves; rollback on rejection; double tap settles on last state.
- **`screens/Today.test.tsx` (RTL):** renders groups and "1 of 4 done" from mock data; tapping a task updates the count; toggle switches view and persists; Pull from bank adds a task; empty day.
- **Manual:** iPhone-width check in devtools and on the phone via `npm run dev -- --host`.

## Boundaries

- **Always:** keep logic in `domain/`/`hooks/`; screens call only `src/api/client.ts`; run test, lint, build before each commit; update `../docs/` in the same work if behavior described there changes.
- **Ask first:** any dependency beyond the three above; changing types outside the data model; adding a router.
- **Never:** import `mockData`/`mockStore` outside `src/api/`; change Today without a user action (no timers, no auto-reflow); shame or nag copy.

## Success criteria

- [ ] Every acceptance criterion on #2 is met, plus undo.
- [ ] Domain, client, storage, hook and screen tests above exist and pass.
- [ ] `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Today renders correctly at 375 and 390 px with no horizontal scroll.
- [ ] Reloading keeps the chosen view; check-offs survive until page reload (mock store).
- [ ] No module outside `src/api/` imports mock data (existing lint rule still passes).

## Decisions

1. **Free time line** is static: "The rest is yours." Deriving it from the plan ("Free after 6 p.m.") can come later.
2. **Tasks with no goal and no recurring item** go under Keep life running.
3. **By goal card titles** are "Goal · Aspiration" (e.g. "Be strong · Be fit") on every goal card; goal alone if it has no aspiration.
4. **Skip and Swap** live in a small "⋯" menu per row; swipe later.
5. **ADR-004 split:** optimistic updates and the remembered view here; IndexedDB plan cache, offline queue and precache in #8.
6. **Bank actions** work against the mock store; no week reflow.
7. **Undo:** tapping a done task marks it planned again.
8. **RTL + jsdom** added as dev dependencies for hook and screen tests.

## Plan

See [`tasks/plan.md`](../tasks/plan.md) and [`tasks/todo.md`](../tasks/todo.md).
