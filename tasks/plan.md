# Implementation Plan: Tick off a past day's tasks late (#81)

Spec: [`../specs/081-late-check-offs.md`](../specs/081-late-check-offs.md). Issue: [#81](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/81). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

A past day shows the note "This day has passed. You can still tick off what you did.", every task that was on it (lapsed and since-dropped ones included), and a line under each unfinished one that ended with its week. A tick counts for the day opened. A closed week's day offers nothing but ticking and the quit row. Front end only: one PR, branch `late-check-offs`, closes #81. Docs in a root-repo PR after it.

## Architecture decisions

- **What the API sends** (checked in `ListWeekTasks`): a past week's row carries that week's `week` and `plannedDay`, its `weekOutcome`, and the task's state now. A rolled-over task reads `open` (or `done` once ticked anywhere, or `dropped`); a lapsed one `lapsed`. A lapsed task ticked late has its row turned to done, so it reads `done` with `weekOutcome: null`; unticked, it lapses again. A rolled-over task ticked late keeps `weekOutcome: 'rolledOver'` and reads `done`.
- **Showing them:** `visibleTasks` (today.ts) keeps a task on its day when it has a `weekOutcome`, whatever its state; `isOnDay` stays as it is for everything else (the bank, a not-open day, Still matter?).
- **The line:** `outcomeLine(task)` in `domain/today.ts`, set on the `TaskRow` data as `outcome`. `TaskRow` renders it under the subline, in the subline's style, and adds it to `aria-describedby`.
- **Ticking:** `canTickLate(task)` is false only for `dropped`. `checkOffAt(now, day)`: `completedOn` is `day`; `useDay.toggleDone` passes the opened day when it's before today, else the phone's day as now (`toLocalDay(now)`), so a tick just after midnight on a stale Today still counts for the new day.
- **Replay in a closed week** (`domain/replay.ts`, the week's `status`): a check-off of a lapsed task makes it `done` with `weekOutcome: null`; an uncheck of a done task that isn't `rolledOver` makes it `lapsed` with `weekOutcome: 'lapsed'`. A rolled-over task just changes state. In open weeks, nothing changes. The stored current week replays the same check-off by task id, so a rolled-over task leaves its bank at once (already true; tested).
- **What a day offers:** `DayView` gains `isPast` (the note) and `offersMenu` (false on a closed week's day). Day passes no menu handlers when `offersMenu` is false; a row is disabled when `canCheckOff` is false or `canTickLate` is false (a per-row `canCheck` from the domain).
- **The mock:** `StoredTask` gains `rolledFrom: { week, plannedDay }[]`, written when a week closes and a task carries over. `closedWeekTasks` adds each task with an entry for that week, with that week and day and `weekOutcome: 'rolledOver'`. `uncheckTask` puts a task back to `lapsed` when its week is before the current week. The seed gets a rolled-over task from last week ("Groceries", as the design), so `npm run dev:mock` shows both cases.
- **A rolled-over task that was in the bank** when its week ended has no day, so it shows only in that week's bank on Week, not on a day. Ticking it from there is out of scope (spec: only from an opened day).

## Task list

Each task leaves tests, lint and build passing and is its own commit.

1. **The wording and what's ticked.** `visibleTasks` keeps `weekOutcome` rows; `outcomeLine`; `canTickLate`; `checkOffAt(now, day)`. Files: `domain/today.ts`, `domain/tasks.ts`, their tests.
2. **Replay in a closed week.** Lapsed ↔ done with `weekOutcome`; a rolled-over task's tick over the current week leaves its bank. Files: `domain/replay.ts`, `domain/replay.test.ts`.
3. **The mock.** `rolledFrom`, written on close; closed weeks list rolled-over tasks; uncheck lapses again; the seed's rolled-over task. Files: `api/mockData.ts`, `api/client.ts`, `api/client.test.ts`.
4. **The day's hook.** `isPast`, `offersMenu`, per-row ticking, the day sent with a tick. Files: `hooks/useDay.ts`, `hooks/useDay.test.tsx`, `domain/today.ts` if the row's `canCheck` lives there.
5. **The screen.** The note; the outcome line in `TaskRow`; no menus on a closed week's day; disabled rows. Files: `screens/Day.tsx`, `components/TaskRow.tsx`, `TaskRow.css`, `screens/Day.test.tsx`.
6. **The quit row on a closed week's day.** Tests first; code only if it doesn't already show. Files: `screens/Day.test.tsx`, maybe `domain/quitting.ts`.
7. **Docs.** `docs/screens/README.md` (opened past day; "A past day" built), `docs/flows.md` flow 9, `docs/data-model.md` (late check-offs from any past day, completedOn is that day), the brief's status line, `specs/README.md`, the spec's status, `CLAUDE.md` if the queue line needs it.
8. **The check.** A Sonnet agent at 390 px against the local API and dev server (already running), as the spec's Testing says; findings fixed or reported; a "Checked" note in the spec.

Checkpoints: after 3 (full suite, lint, build), after 6 (the screen end to end on `npm run dev:mock`), after 8. Then a review step before the PR is merged.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The local API has no rolled-over or lapsed task to tick | Med | The agent makes them: adds a "Verification: …" task to an earlier day of this week, or uses last week's real rows; if none exist, it reports that and checks with `npm run dev:mock` instead. |
| Replay's lapsed rule guesses wrong for a case the API handles differently | Low | The next read settles it; the rule only covers the two cases the API spec tests (rolled over, lapsed). |
| Sending the opened day changes this week's past-day ticks | Low | Nothing on screen reads `completedOn` today (Week's "done" goes by the day); covered by a hook test. |
| Removing menus on closed weeks hides Delete for a task made by mistake | Low | Agreed (decision 4): delete it from where it lives now. |

## Open questions

None.
