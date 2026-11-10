# Spec: Week screen (#3)

Status: approved 2026-11-10. Issue: [#3](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/3). Depends on #1 and #2 (done).

## Objective

The Week screen is where the person sees how the week is going and shapes it: progress toward each goal's weekly target, the plan for each day from Monday to Sunday, and the bank of this week's tasks that aren't on a day yet. It's opened a few times a week. From it, any day opens as a full day screen, the same as Today.

This is also the app's first second screen, so it brings navigation: a bottom tab bar (Today | Week) whose current screen survives reloads and iOS restarts (ADR-004).

References: [Flow 3](../../docs/flows.md#flow-3-fill-the-task-bank), [Flow 4](../../docs/flows.md#flow-4-plan-today), [product rules: planning](../../docs/product-rules.md#planning), [`week.png`](../../docs/screens/week.png), [screens README](../../docs/screens/README.md#week).

### What the person sees

**Week screen**

- **Header:** "This week" and the date range ("Nov 9–15").
- **Progress:** one row per active building goal that has a weekly target:
  - title "Be strong · Be fit" (goal · aspiration, as on Today), "1 of 3" on the right, and a progress bar;
  - under it, the pacing line: "6 days left · on pace" (rules below).
- **Days:** Monday to Sunday, one row each:
  - the day name, then the day's task titles joined with " · ", timed tasks with their label ("Trash by 7 a.m."); "done" on the right once every task that day is done;
  - a day with no tasks reads "Free day";
  - today is highlighted, past days are dimmed;
  - each row is a button that opens that day.
- **Bank:** "Bank · 3 not on a day", then one chip per bank task. Tapping a chip opens a sheet, "Put on a day", listing Today first, then each later day this week. Picking one places the task there. Hint below the chips: "Tap to put on a day." Empty bank: "Nothing in the bank."

**Day screen (any day, opened from Week)**

- The Today screen, for that date: same groups, check-off and undo, ⋯ menu (Back to bank, Swap), Pull from bank, List / By goal toggle.
- Heading: "Today · Wednesday" for today; otherwise "Thursday · Nov 12".
- Every action works on every day, including check-off (doing something early counts).
- Pull from bank and Swap place the task on *that* day, not on today.
- A back button, "‹ Week", returns to the Week screen.

**Tab bar**

- Fixed to the bottom, above the safe area: **Today** and **Week**. The current one is marked (`aria-current="page"`).
- A day opened from Week counts as Week in the tab bar.
- The current screen (including which day is open) is restored after a reload or iOS restart.

### Pacing rules

For a goal with a count target (`WeeklyTarget.amount` tasks a week):

- **Done:** this week's tasks for the goal with status `done`.
- **Days left:** today through Sunday, inclusive (Tuesday → "6 days left", Sunday → "1 day left").
- **Pacing line:**
  - target met: "Done for the week";
  - done + planned on today or later ≥ target: "N days left · on pace";
  - otherwise: "N days left · M more to plan" (M = target − done − planned on today or later).

No other wording, colour or warning; falling short is never shown as failure.

### Placed by hand

`Task` gets `placedByHand?: boolean`. It is set to `true` whenever the person puts a task on a day (Pull from bank, Swap, Put on a day) and removed when the task goes back to the bank. Nothing reads it yet: the future planner must never move a task that has it (product rule 6). `../docs/data-model.md` gets the field.

## Scope

**In:**
- `domain/week.ts`: progress and pacing, day summaries, week range label, day heading for any date.
- `api/client.ts`: `getWeek`, `getDay(date)`; `pullFromBank` and `swapTask` place onto a given day; `placedByHand` handling. Mock data for a fuller week.
- `hooks/useWeek.ts`; `hooks/useToday.ts` becomes `useDay(date)`.
- `hooks/useNavigation.ts` + `storage/navigation.ts`: current screen, persisted.
- `screens/Week.tsx`; `screens/Today.tsx` becomes `screens/Day.tsx` (date as a prop); `components/TabBar.tsx`, day-picker sheet.
- Docs: data model (`placedByHand`), screens README (Week: tap, then pick a day; drag later).

**Out (later):**
- Real URLs / a router (navigation goes through `useNavigation()` so it can be added by changing that hook and `App.tsx`).
- Drag-and-drop onto a day.
- Amount targets ("1 of 7 h", miles): need a summed `valueLogged` or durations; only count targets now.
- Drafting or reflowing the week (planner), overload warnings, "Still matter?", other weeks.
- Goals, Goal detail, Add, Settings tabs.

## API changes

```ts
getDay(date: string): Promise<DayPlan>
// Tasks planned for that date plus what they reference. getToday() becomes getDay(today);
// TodayPlan is renamed DayPlan.

getWeek(): Promise<WeekPlan>
// { weekOf, tasks, goals, aspirations, recurringItems, weeklyTargets }:
// every task with this weekOf (planned, done and in the bank), plus the records they
// reference and the weekly targets of active goals.

pullFromBank(bankTaskId: string, day?: string): Promise<Task>
// Places the task on `day` (default today), sets placedByHand.

swapTask(taskId: string, bankTaskId: string): Promise<{ skipped: Task; placed: Task }>
// The bank task goes to the swapped task's day (not always today), with placedByHand.

skipTask(taskId: string): Promise<Task>
// Also clears placedByHand.
```

The bank picker uses `pullFromBank(id, day)`; there's no separate "place" function. All functions keep #1's rules: async, return copies, reject unknown or wrong-status IDs.

## Mock dataset

Extend the week so the screen has something to show on most days, still relative to the current Monday:

- At least one task on each of Monday, Thursday, Friday and Saturday besides today's, so most rows have content; Sunday has none (Free day) unless today is Sunday.
- Lift tasks: one done on Monday, one today, one in the bank (so "1 of 3", "1 more to plan").
- A fixed-day recurring task (trash on Tuesday) and a flexible one.
- Tasks placed by hand in the mock data have `placedByHand: true`.

## Code style

Same as #2: no semicolons, single quotes, 2-space indent, `.ts`/`.tsx` imports, named exports, small functions, logic in `domain/` and `hooks/`, components render. Screens never call each other or touch `localStorage`; they navigate through `useNavigation()`.

```ts
// domain/week.ts
export function pacingLine({ done, plannedAhead, target, daysLeft }: Pacing): string {
  if (done >= target) return 'Done for the week'
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
  const toPlan = target - done - plannedAhead
  return toPlan <= 0 ? `${days} · on pace` : `${days} · ${toPlan} more to plan`
}
```

## Commands

```bash
nvm use           # Node 24
npm test
npm run lint
npm run build
npm run dev -- --host   # check on the phone
```

## Testing strategy

- **`domain/week.test.ts`:** pacing (met, on pace, behind, Sunday "1 day left"), progress counts ignore other goals and other weeks, day summaries (timed labels, "done", "Free day"), week range across a month boundary ("Nov 30–Dec 6"), day heading for today and other days.
- **`api/client.test.ts`:** `getDay` for another date; `getWeek` contents; `pullFromBank` onto a given day; `swapTask` keeps the swapped task's day; `placedByHand` set and cleared.
- **`storage/navigation.test.ts`:** default Today; round-trip including a day; unknown or blocked storage falls back to Today.
- **`hooks/useDay.test.tsx`:** existing `useToday` tests, now via `useDay(today)`, plus pull onto a non-today date.
- **`screens/Week.test.tsx`:** progress row and pacing line from mock data; seven day rows with today marked (`aria-current="date"`); tapping a day opens it; bank chip → pick Thursday → task appears in Thursday's row.
- **`App.test.tsx`:** tab bar switches screens; the current screen survives a remount.
- **Manual:** iPhone width, light and dark, tab bar clears the home indicator.

## Boundaries

- **Always:** navigate only through `useNavigation()`; keep `domain/` free of React; run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency (including a router or drag library); changing the shape of `Task` beyond `placedByHand`.
- **Never:** move a task with `placedByHand`; move tasks on their own (no timers, no auto-reflow); shame or pace-nagging copy.

## Success criteria

- [ ] Every acceptance criterion on #3 is met, with drag replaced by tap-then-pick-a-day.
- [ ] Any day opens as a full day screen with every Today action, placing pulled and swapped tasks on that day.
- [ ] Tab bar switches Today and Week; the current screen (including an open day) survives reload.
- [ ] `placedByHand` is set and cleared as described, and documented in the data model.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Decisions

1. **No router yet.** Tab bar with screen state behind `useNavigation()`, persisted in `localStorage`. A router can replace the hook's internals later.
2. **Any day is a full day screen.** Today becomes `Day` with a date; every action works on every day.
3. **Tap, then pick a day** instead of drag; drag may come later.
4. **`placedByHand` recorded now** so the planner can respect it.

5. **Fixed-day items** (trash on Tuesday) have no ⋯ menu, so they can't be sent back to the bank or swapped away. They can still be checked off.
6. **Pacing wording:** "M more to plan" when behind; "Done for the week" when the target is met.
7. **Past days** are left out of "Put on a day".

## Plan

See [`tasks/plan.md`](../tasks/plan.md) and [`tasks/todo.md`](../tasks/todo.md).
