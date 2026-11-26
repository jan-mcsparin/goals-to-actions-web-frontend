# Spec: Move or remove a future day's set items

Status: built, 2026-11-25 (plan in `tasks/plan.md`); the fixed-day move is in (Jan, 2026-11-25), other decisions agreed as proposed. One choice made in building: a fixed-day task's Move shows only on today or a later day, like a set item's (past days are #81). Issue: [#82](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/82). The third front-end piece of the scheduling brief, written with [080](080-any-week.md) and built after it. Needs API [#50](https://github.com/jan-mcsparin/goals-to-actions-api/issues/50) (a move across weeks, `placeTask`; `dropTask`) and [#51](https://github.com/jan-mcsparin/goals-to-actions-api/issues/51) (reading the week it's in), both built, and one small API change made with it (below). Follows 038.

## Objective

A task set to a day can be moved to another day, in any week, or removed; and a fixed-day task can move to another day of its week (a holiday moves trash day from Tuesday to Wednesday). Today a task put on a day with On a day (079) stays there for good unless it's deleted as a mistake: there's no way to say "the dentist moved to the 19th" or "I'm not going after all".

References: [brief](../../docs/briefs/scheduling-and-other-weeks.md) ("On a day", "Notes for the specs": Remove vs. Delete, moving a fixed-day task); [`api/specs/on-a-day.md`](../../api/specs/on-a-day.md) (what moves, the 409s); spec 038 (Delete, and Drop kept out of menus); [`data-model.md`](../../docs/data-model.md) (drop and delete).

### What exists afterwards

1. **What's a set item:** an unfinished task added by hand (`origin: 'byHand'`) that is on a day, today or later. A one-off goal's step added by hand counts. Goal sessions and recurring tasks aren't set items: the API keeps them in their own week, and they keep today's menu.
2. **A set item's ⋯ menu** gains, in this order: Back to bank and Swap where they show now, then **Move to another day**, **Remove (not doing it)**, and **Delete (made by mistake)** last, as now (decision 1).
3. **Move to another day** opens a sheet titled "Move to another day" with the task's title, a native date input preset to its current day (`min` today, no `max`, as the Add sheet's Day), Cancel and **Move**, which is on once the day differs. Moving:
   - goes through the queue as a `place` (the same change as putting a bank task on a day), so it shows at once and waits if it can't be sent;
   - shows on its new day at once when that day is in a stored week, and leaves its old day at once either way (`replay`: a `place` to a day outside the row's week takes the task out of that week, and into the new week if it's stored);
   - says where it went: "Moved to Sat, Dec 19." (the 079 day label);
   - ends with the server's answer; a 409 drops the change as for any queued place, and the next read shows where the task really is.
4. **Remove (not doing it)** asks once, in the `DeleteSheet` pattern with its own words: "Remove “Dentist cleaning”? It's not done, and nothing counts against you." with **Cancel** first and **Remove**. It sends `dropTask`, needs a connection, and isn't queued: nothing changes until the server has it, as Delete (decision 2). A failure says "Couldn't remove that. Try again."
5. **An opened day of a week that hasn't opened** lists its set tasks, each with the menu (Move, Remove, Delete), then its known items, read-only and joined in one list under "Also that day": fixed-day items ("Take out the trash"), "Check in: Lift · Milestone 3 of 4" and "Deadline: Lift". The note from Week heads the day: "Only what's set to a day shows here. Recurring work is placed when this week opens." No progress bar, no check-off, no Pull or Swap. An empty day reads "Nothing set yet".
6. **A fixed-day task can move within its week.** Its ⋯ menu becomes **Move to another day**, then **Delete (made by mistake)**. Move opens the existing day picker with the days of its week from today on ("Put on a day" becomes the sheet's title passed in: "Move to another day"). The task moves for that week only: it's placed by hand there, so nothing puts it back, and the item keeps its day for later weeks. Back to bank and Swap stay off for it, as now. Queued as a `place`, like any move.
7. **Mock:** `placeTask` moves a hand-added task to a day in another week (and refuses a generated one with the API's 409), and a fixed-day task within its week; `dropTask` drops it.

## The API change

In `goals-to-actions-api`, its own PR ("Part of web-frontend#82"), merged before the front end's:

- `app/tasks/rules.py`, `place`: no `keep_on_its_day` for a move. A fixed-day task can go to any day of its own week from today on; across weeks it's still refused ("A goal session or a recurring task stays in its own week."). `move_to_bank` and `swap` keep the check: a fixed-day task never goes to the bank.
- Once moved, the row is `placed_by_hand`, so `rework` (a recurring edit) and the planner leave it where the person put it. Moving it back to its own day is an ordinary move.
- `Task.fixedDay`'s description: "From a weekly or monthly recurring item, in the week it was due: it doesn't go to the bank, and moves only within its week." `placeTask`'s 409 list loses "a fixed-day task moved off its day". Then `uv run python -m app.openapi`; the front end regenerates its types.
- Tests (`tests/test_tasks*.py`, `tests/test_recurring_edit*.py`): move a fixed-day task to tomorrow, and back; to another week (409); to the bank and swapped (409, as now); after the move, editing its item's name or schedule leaves it on the new day; sent twice.
- Docs: `api/specs/on-a-day.md` "Not in this" / `tasks-week.md` (wherever "stays on its day" is stated), `docs/flows.md` and `docs/data-model.md` where fixed-day tasks are said never to move.

## Scope

**In:**

- `src/domain/tasks.ts`: `isSetItem(task, today)`; `canMoveInWeek(task, today)` for a fixed-day task.
- `src/domain/replay.ts`: a `place` across weeks (item 3).
- `src/domain/today.ts` or a new `src/domain/notOpenDay.ts`: an opened not-open day's tasks and known items.
- `src/hooks/useDay.ts`: `move(taskId, day)` (queued) and `removing` (asked once, sent, reload), modelled on `useDelete`.
- `src/api/client.ts`, `realPlan.ts`, `mockStore.ts`: `dropTask`; the mock's cross-week `placeTask`.
- `src/api/openapi.ts` regenerated after the API change.
- `src/components/TaskMenu.tsx` (two new actions), a `MoveSheet.tsx`, `DayPickerSheet.tsx` (its title passed in); `DeleteSheet` reused for Remove with its button text passed in.
- `src/screens/Day.tsx`, `Day.css`: the menu actions, the sheets, a not-open day.
- Tests: `domain/tasks.test.ts`, `domain/replay.test.ts`, `hooks/useDay.test.tsx`, `screens/Day.test.tsx`, `api/client.test.ts` (mock move and drop).
- Docs: `docs/screens/README.md` (Today's menu, Week's opened day, Deleting: how Remove reads beside it), `docs/flows.md` flow 3 ("Later weeks") and flow 7 (Remove is a drop), the brief's status line, `specs/README.md`.

**Out:**

- Moving goal sessions or recurring tasks to another week (the API refuses it, on-a-day decision 1).
- Move or Remove from Week's day rows, the bank, or Coming up (#83): only from an opened day.
- Past days (#81).

## Decisions

Agreed with Jan, 2026-11-25.

1. **"Remove (not doing it)" beside "Delete (made by mistake)".** The brackets carry the difference in the same pattern 038 uses, so the two can't be confused: one is a decision kept in history, the other undoes a mistake. 038's rule that Drop never sits in a task's menu is narrowed: Remove shows only on set items, where the brief puts it. The alternative, "Not going", reads well for an appointment but oddly for "Pay the ski trip deposit".
2. **Remove asks once and isn't queued.** A drop has no undo in the API, and a mis-tap in a menu is easy; "Still matter?"'s Drop goes at once because the card itself is the question. Not queued, like Still matter?: it's rare, and a drop sent hours later from a stale screen could end the wrong thing.
3. **Moving a fixed-day task for one week is part of this** (Jan, 2026-11-25), with the API change above. It moves within its week only, by the week's day picker; it never goes to the bank.
4. **Move is offered from today on, today included:** "can't make it today, Thursday instead" is the same act. On today a set item still has Back to bank and Swap as now.
5. **Move uses the native date input**, as the Add sheet's Day: no date-picker library, and no limit at 12 weeks (the API reads any week; Coming up and Week just won't show past 12).

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm test
npm run lint
npm run build
```

## Code style

As spec 038: what's offered is decided in `domain/`, the save in the hook, the menu only renders the actions it's given.

```ts
// Added by hand, unfinished, on a day from today on: it can be moved or removed.
export function isSetItem(task: Task, today: string): boolean {
  return task.origin === 'byHand' && isPlanned(task) && task.plannedDay !== null && task.plannedDay >= today
}
```

```tsx
<TaskMenu
  taskTitle={task.title}
  onSendToBank={...}
  onSwap={...}
  onMove={setItem ? () => setMoving(task) : undefined}
  onRemove={setItem ? () => removing.ask(task) : undefined}
  onDelete={() => deleting.ask(task)}
/>
```

## Testing

- `domain/tasks.test.ts`: a set item is by hand, open and on a day from today on; not a goal session, a recurring task, a done task, a bank task or yesterday's.
- `domain/replay.test.ts`: a queued move to another week leaves the stored week, and lands in the other one when it's stored; a move within the week as before.
- `useDay.test.tsx`: a move shows at once and says "Moved to …"; Remove asks, sends, and the task goes once the server has it; a failed Remove keeps the task and says so.
- `Day.test.tsx`: the menu's order for a set item, for a goal session, for a fixed-day task (Move, then Delete; its picker lists only its week's days from today on); Move's button off until the day changes; Remove's sheet puts Cancel first; a not-open day shows the note, its set tasks with menus, "Also that day" and no check-off.
- Then a sonnet agent checks on the real API at 390 px: move the 079 dentist task to another later week and back to this week, remove a "Verification: …" task, move this week's fixed-day task to another day and see it stay there after editing its item's name, and confirm a goal session's menu has no Move. Then Week (080) shows each where it landed.

## Boundaries

- **Always:** `nvm use` first; tests, lint and build before saying it's done; docs in the same PR.
- **Ask first:** queueing Remove; offering Move for generated tasks; a new dependency.
- **Never:** word Remove or Delete so they read alike; decide on the phone where a moved task lands beyond the prediction the queue already makes (ADR-008).

## Success criteria

- A set item moved three weeks out is, on the real API, a hand-placed row on that day, gone from its old day; moved back, it's on this week's day.
- A removed set item is dropped on the server and gone from the day, with nothing else changed.
- A fixed-day task moved to another day of its week stays there, and the item keeps its day next week.
- Goal sessions and flexible recurring tasks offer exactly what they did before.
- Tests, lint and build pass.

## Checked

By a Sonnet agent at 390px against the local API (on the `move-fixed-day` branch), 2026-11-25. "Verification: dentist" on Fri Nov 27 had Back to bank, Swap, Move to another day, Remove (not doing it), Delete (made by mistake). Move: the sheet had its title, the task and a date preset to its day, Move off until the day changed; moved to Dec 16 it left Friday at once with "Moved to Wed, Dec 16.", showed on Wed of Week of Dec 14, and the read had it there, placed by hand. That day (not open) showed the note, the task with Move, Remove and Delete only, no progress bar, Pull from bank or check-off; Tue Dec 15 listed "Take out the trash" under Also that day. Moved back to Friday: "Moved to Fri, Nov 27." and there. Remove asked "Remove “Verification: remove me”? It's not done, and nothing counts against you." with Cancel first; the task left the day and the read. A fixed-day item (every Friday) had Move to another day and Delete only; the picker listed Today, Thursday, Saturday and Sunday; moved to Saturday, it stayed there after its item was renamed, with the new name, and next week had no copy. A goal session had no Move or Remove. No horizontal scroll; no app errors in the console.

## Open questions

None.
