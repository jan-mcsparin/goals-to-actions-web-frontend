# Spec: Tick off a past day's tasks late

Status: built 2026-11-25, decisions 1 to 6 agreed with Jan as recommended; plan in `tasks/plan.md`. Issue: [#81](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/81). The fourth front-end piece of the scheduling brief, after [080](080-any-week.md) and [082](082-move-and-remove.md). Needs API [#51](https://github.com/jan-mcsparin/goals-to-actions-api/issues/51) ([`api/specs/any-week.md`](../../api/specs/any-week.md), built): the past week's read carries every row with its `weekOutcome`, and late check-offs needed no API code. No API change and no new types.

## Objective

A past day opens with everything that was on it, and the person can tick off what they did but didn't mark. Since 080 a day of a past week opens, but it reads like any day: a rolled-over task shows as a plain unticked row, a lapsed one (`state: 'lapsed'`) doesn't show at all (`isOnDay` leaves it out), nothing says what became of either, and a tick sends today's date.

References: [brief](../../docs/briefs/scheduling-and-other-weeks.md) ("A past day", "Notes for the specs": quitting goals); design [`scheduling.png`](../../docs/screens/scheduling.png), panel "A past day: ticking off late"; [`data-model.md`](../../docs/data-model.md) (late check-offs); [`flows.md`](../../docs/flows.md) flow 9 step 3; product rules (tone: no "overdue", "missed" or "behind").

### What exists afterwards

1. **A past day** is any day before today, in this week or an earlier one. Under the pinned top it shows the note "This day has passed. You can still tick off what you did." (the `today-note` style 082 uses for a not-open day), on every past day (decision 1).
2. **Everything that was on the day shows**, done or not, in List or By goal as now: a row with a `weekOutcome` shows whatever the task's `state` is now (open, done, lapsed or dropped). "2 of 3 done" counts them all, as the design does.
3. **An unfinished task that ended with the week** gets a line under its title (decision 2):
   - `weekOutcome: 'rolledOver'`: "Moved on to the next week · tap if you did it";
   - `weekOutcome: 'lapsed'`: "Tap if you did it".
   Once ticked, the line goes and the row reads done like any other. An unfinished task on a past day of this week is still in play and gets no line.
4. **Tapping checks it off for that day:** the check-off's `completedOn` is the day opened, `completedAt` the moment of the tap (decision 3). It goes through the queue as now and shows at once. The server lands it where `data-model.md` says: a rolled-over task is done on its row in the week it moved to, so it leaves this week's bank (the stored current week replays the same change, so that shows at once too); a lapsed one turns its row and task to done.
5. **Unchecking works the same way round:** a rolled-over task goes back in play in the current week; a lapsed one lapses again. A task done on time in a past week and unticked now gets the ending its week would have given it (the API's `uncheck`): a task added by hand rolls into this week's bank, a goal session lapses. The row shows unticked at once; its line comes back with the read once the queue has sent it, since only the server knows which ending applies (ADR-008).
6. **Nothing else is offered on a closed week's day:** no ⋯ menu (no Back to bank, Swap, Move, Remove or Delete), no Pull from bank, as the issue says (decision 4). A past day of this week keeps what it offers now: Back to bank and Delete in the menu, no Pull or Swap.
7. **A quitting goal's row** shows on every past day the week's read has a quit day for, closed weeks included, and works as on Today: answered, changed, cleared, rated, through the queue (decision 5). This is what spec 037 did for opened days of this week; it may already work on closed weeks and only needs tests.
8. **A task that can't be ticked any more** (rolled over, then dropped since: `state: 'dropped'`) shows "Moved on to the next week" alone and can't be checked (decision 6). A rolled-over task done since, in a later week, shows ticked; unticking it undoes that check-off, since it's one task.
9. **Mock:** a closed week also lists the tasks that rolled over out of it, on the day they had there (the mock keeps one row per task, so it needs to remember where a task was before it carried over); checking off and unchecking a lapsed task as the API does (lapsed → done → lapsed). The mock's last week gets a rolled-over task, so `npm run dev:mock` and the tests have both cases.

## Scope

**In:**

- `src/domain/tasks.ts`: `checkOffAt(now, day)` takes the day it counts for; `canTickLate(task)`.
- `src/domain/replay.ts`: no change. A tick replays as done, which hides the line; an untick replays as open, and the read settles its ending.
- `src/domain/today.ts`: `visibleTasks` keeps any task with a `weekOutcome` on its day; a row's `outcome` line (`'Moved on to the next week · tap if you did it'`, `'Tap if you did it'`, `'Moved on to the next week'`), in `TaskRow`.
- `src/hooks/useDay.ts`: `DayView.isPast` and `isClosed` (or one `pastNote` and `canChange`); `toggleDone` sends the opened day as `completedOn` on a past day.
- `src/components/TaskRow.tsx`, `TaskRow.css`/`taskText.css`: the outcome line, read with the title (`aria-describedby`); no menu when the day offers none.
- `src/screens/Day.tsx`: the note; menus off on a closed week's day.
- `src/api/mockStore.ts`: late check-off and uncheck of rolled-over and lapsed tasks.
- Tests: `domain/tasks.test.ts`, `domain/today.test.ts`, `domain/replay.test.ts` (a late check-off replayed over the current week takes the task out of its bank), `hooks/useDay.test.tsx`, `screens/Day.test.tsx`, `api/client.test.ts` (mock).
- Docs: `docs/screens/README.md` (Today's opened past day; Week, "A past week"; the scheduling section's "A past day" marked built), `docs/flows.md` flow 9 ("Past days … are to come"), `data-model.md` if the late check-off wording needs "from any past day", the brief's status line, `specs/README.md` (this spec, then done), ADR-010 if decision 3 is worth a line there.

**Out:**

- Anything on the API.
- Ticking off from Week's day rows or the bank: only from an opened day, as now.
- Placing, moving or dropping anything on a past day.
- A count, badge or prompt about unticked past tasks anywhere.

## Decisions

Agreed with Jan, 2026-11-25, as recommended.

1. **The note shows on every past day, this week's too.** Recommended: yes. It's the same fact ("this day has passed") and the same invitation, and a past day of this week is where late ticks happen most. The alternative, closed weeks only, makes Monday's day read differently on Wednesday and the next Wednesday for no reason the person sees.
2. **Where the outcome line sits.** The design shows it as the row's second line ("Groceries" has no goal). Recommended: **under the goal subline**, as a third line when there is one ("Lift: bench day" / "Lift · Be fit" / "Tap if you did it"), in the subline's muted style. The alternative, replacing the goal subline, keeps rows two lines tall but loses which goal a task was for in the List view.
3. **A late tick counts for the day it was on,** not the day it's tapped. To count it for another day, move it first, to today or later; nothing moves onto a past day, so a task planned Monday and done Tuesday, both past, counts for Monday (Jan: reasonable). Recommended: `completedOn` is the opened day for every past day, this week's included (today a tick on Monday's day, sent on Wednesday, says Wednesday). The brief says "checks it off as done on that day", and the API keeps "its day wins, even for a week that has since closed". Nothing on screen changes today, since Week's "done" goes by the day a task is on; it matters for the record and for a one-off goal's step done without a row.
4. **A closed week's day has no ⋯ menu.** Recommended: none at all, Delete included. Back to bank, Swap and Move have nowhere to go in a closed week, Remove on a past task isn't the brief's, and Delete of a past task is rare enough to do from where the task lives now (this week's bank or day). The alternative keeps Delete (made by mistake) alone, for a task that should never have existed.
5. **The quitting goal's row on a closed week's past day** (the issue asks this to be decided). Recommended: **show it, as on any opened past day**, through the queue. Spec 037 already lets a missed day be filled in from the goal page for the last 28 days and from an opened day of this week; a past day of an earlier week is the same act, and leaving it out would make the row appear and vanish by week. A closed week can't be opened offline, so in practice it's sent at once.
6. **A task that's since been dropped** reads "Moved on to the next week" and can't be ticked (the API refuses a dropped task's check-off with a 409). Recommended as above; the alternative, hiding it, would make the day's count change for reasons the day doesn't show.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm test
npm run lint
npm run build
```

## Code style

As spec 042 and 082: what a row says and whether it can be ticked are decided in `domain/`, the send in `useDay`, `TaskRow` renders what it's given.

```ts
// A task left unfinished when its week ended: how it ended, and whether a tap still counts.
export function outcomeLine(task: Task): string | undefined {
  if (isDone(task) || task.weekOutcome === null) return undefined
  if (!canTickLate(task)) return 'Moved on to the next week'
  return task.weekOutcome === 'rolledOver' ? 'Moved on to the next week · tap if you did it' : 'Tap if you did it'
}

// The moment of the tap, counted for the day it was on.
export function checkOffAt(now: Date, day: string): CheckOff {
  return { completedAt: now.toISOString(), completedOn: day }
}
```

## Testing

- `domain/tasks.test.ts`: `checkOffAt` keeps the day given; `canTickLate` for open, lapsed, rolled-over-then-dropped.
- `domain/today.test.ts`: the outcome line for a rolled-over, a lapsed, a done-late and a dropped task; none for an in-play task.
- `domain/replay.test.ts`: a late check-off of a rolled-over task replayed over the current week marks it done there, so it leaves the bank; an uncheck returns it; a lapsed task ticked in a closed week's read reads done.
- `useDay.test.tsx`: a tick on a past day sends that day as `completedOn`; on today, today.
- `Day.test.tsx`: the note on a past day of this week and of a closed week, not on today or a future day; the outcome lines; tick and untick on a closed week's day; no ⋯ menu there, the menu as now on a past day of this week; the quit row on a closed week's day.
- `api/client.test.ts`: the mock's late check-off and uncheck, both cases.
- Then a Sonnet agent checks at 390 px against the local API (the dev server and API are already running; it never stops them): open last week from Week, open a day with a rolled-over task, see the note and line, tick it, go to This week and see it gone from the bank and done; untick it from last week and see it back in the bank; tick a lapsed goal session and see last week's Progress count it; answer a quit day on a closed week's day if there is a quitting goal. Things it makes are named "Verification: …".

## Boundaries

- **Always:** `nvm use` first; tests, lint and build before saying it's done; docs in the same PR; the API decides where a late check-off lands (ADR-008), the phone only replays the change it sent.
- **Ask first:** any wording beyond the brief's on a past day; offering anything but ticking on a closed week's day.
- **Never:** "overdue", "missed", "behind", "late" or a count of unticked tasks in the UI; a prompt to fill in past days; storing a past week on the phone.

## Success criteria

- [ ] A past day of any week opens with the note and every task that was on it.
- [ ] Unfinished rolled-over and lapsed tasks read as the brief says; ticked, they read done.
- [ ] A tick on a past day sends that day; on the real API a rolled-over task ticked late is done and gone from this week's bank, and a lapsed goal session counts in its week's Progress.
- [ ] Unticking undoes each case.
- [ ] A closed week's day offers nothing but ticking (and the quit row, if decision 5 holds).
- [ ] Mock, tests and docs; tests, lint and build pass.

## Open questions

None.

## What changed while building

- **The mock's rolled-over task is "Call the dentist"**, already seeded as rolled over twice, now with last Thursday as its day there. A new seeded task would have changed this week's lists that many tests count, and the seed already had a "Groceries".
- **No code for the quit row:** it already showed on a closed week's day; a test covers it.
- **`checkOffAt(now, day)`'s day is optional,** the phone's day by default, so Today and the tests that call it are unchanged.
- **A row's ⋯ shows only when it has an action,** so a closed week's day passes none and shows none.

## Checked

By a Sonnet agent at 390px against the local API, 2026-11-25 (a Wednesday). Last week (Nov 16–22): Fri Nov 20 and Sat Nov 21 showed the note, their done tasks ticked, the rolled-over "Verification: on today" and "Verification: in the bank" with "Moved on to the next week · tap if you did it", and the lapsed goal session "Run a 10k" with "Tap if you did it"; no ⋯ menus and no Pull from bank. Ticking "Verification: in the bank" on Sat Nov 21 sent `completedOn: "2026-11-21"`, its line went, and This week's bank went from 8 to 7; unticked, the line and the bank task came back. Ticking "Run a 10k" on Fri Nov 20 sent `completedOn: "2026-11-20"` and last week's Progress went from 0 of 3 to 1 of 3; unticked, back to 0 of 3. A quitting goal's Held / Slipped row showed on both of last week's days. This week's Monday had the note and its ⋯ menus; today and Thursday had no note. No dropped task was there to see (covered by `Day.test.tsx`). No horizontal scroll; no app errors in the console.
