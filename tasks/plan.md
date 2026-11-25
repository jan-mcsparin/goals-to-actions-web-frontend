# Implementation Plan: A quitting goal's daily answer and urge rating (#37)

Spec: [`../specs/037-quitting-goal-daily-answer.md`](../specs/037-quitting-goal-daily-answer.md). Issue: [#37](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/37). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

A quiet Held / Slipped row per active quitting goal on Today and an opened day, an optional Low · Some · Strong urge rating once answered, and the goal page's record ("12 days held", the last 28 days). Every answer and rating goes through the queue, so it shows at once and works offline.

## Architecture decisions

- **Four queue kinds** in `domain/replay.ts`'s `Change`: `answerQuitDay { goalId, day, held }`, `clearQuitDay { goalId, day }`, `rateUrge { goalId, day, level }`, `clearUrgeRating { goalId, day }`. Each states its end result, so sending twice is harmless. A 409 (day before the start, in the future, after the end) drops it, as now. Replay sets the day in `week.quittingGoals[].days`; it does nothing when the goal or day isn't in the week.
- **Client functions** in `realGoals.ts` (`PUT /goals/{id}/quit-days/{day}`, `POST …/clear`, `PUT /goals/{id}/urges/{day}`, `POST …/clear`), marked queued like the plan writes, with mock twins in `client.ts`. The mock keeps quit days in `store.quitDays` (one row per goal and day, `held` and `urge`) and builds `quittingGoals` and `quitRecord` the API's way: run = held answers since the last no; `unknownInRun` = unanswered days before today inside the run.
- **`domain/quitting.ts`** (new, no React): a day's row (`unanswered` / `held` / `slipped`, urge, or nothing for a future day), the run line ("12 days held", "12 days held · 2 not answered"), the 28 days' wording (Held, Slipped, a dash; with the urge), and `withQueuedQuitDays(record, goalId, changes)`, the same rules over the goal read's record.
- **Clear means back to unknown:** clearing an answer also clears its urge rating when there is one (two queued changes). Otherwise a hidden rating would come back when the day is answered again.
- **Today and an opened day:** `useDay` returns `quitRows` from the replayed week and `answerQuitDay(goalId, held)`, `clearQuitDay(goalId)`, `rateUrge(goalId, level | null)`. Rows sit under the tasks (above Free time), are never counted in progress, and show on an empty day too. `components/QuitDayRow.tsx` renders one: unanswered shows Held and Slipped; answered shows the answer as a button that opens Held · Slipped · Clear, plus Low · Some · Strong (tapping the chosen level clears it).
- **Goal page:** `useGoal` replays the queue's quit changes over `quitRecord` (via `useQueue`) and reads the goal again on `onEmptied`, so the run's number is always the server's (decision 4). `goalPage` swaps "Since Nov 3" for the run line and adds the 28 days. Tapping a day opens `QuitDaySheet` (native `<dialog>`, `useModalDialog`) holding the same `QuitDayRow` controls for that day.

## Tasks

1. **Queue kinds and real client functions.** `Change` gains the four kinds; replay rules over the week; `queue.ts` sends them; `realGoals.ts` functions with mock stubs. Tests: each rule, a rule with no matching goal or day; queue sends each to the right function; the real functions' requests. (M)
2. **The mock's quit days.** `store.quitDays`; the four writes (refused before the start, in the future, on a non-quitting goal); `quittingGoals` in the week read; `quitRecord` in the goal read. Tests in `client.test.ts`: answer, change, clear, rate; the run and `unknownInRun`; a building goal refused. (M)
3. **`domain/quitting.ts`.** Row state, run line, 28 days' wording, `withQueuedQuitDays`. Unit tests, including "a gap reads as a dash, never a slip". (S)
4. **The row on Today and an opened day.** `useDay`, `QuitDayRow`, `Day.tsx`, CSS. Tests: answer, change, clear (clears the urge too), rate and unrate on Today; an opened past day; nothing on a future day; "1 of 4 done" unchanged; no row for a building or one-off goal. (M)
5. **The goal page's record.** `goalDetail.ts`, `useGoal`, `GoalDetail.tsx`, `QuitDaySheet`. Tests: run line with and without unknown days; the 28 days; answering a day two weeks back shows at once and the goal is read again once the queue empties. (M)
6. **Docs and check.** This repo's `CLAUDE.md` (what's queued), `../docs/screens/README.md` (Today, Goal detail, "Not yet on screen"), `../docs/flows.md` flow 2 if needed, ADR-010 "Built" notes, spec status, specs README. Sonnet agent runs the manual checks at phone width against the local API. (S)

## Checkpoints

- After 1–3: tests, lint and build pass; `npm run dev:mock` week read carries quit days.
- After 4–5: whole suite; the click-through answers from Today and the goal page.
- After 6: Sonnet agent's manual run; PR "Closes #37".

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Goal page replays a change the week read never settles (no week read while there) | Low: the change states its end result, so it matches the server's | Overlay only; `onEmptied` reload brings the server's run |
| The week read's days list may leave out future days | Low | The row shows nothing for a future day either way |
