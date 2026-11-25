# Spec: A quitting goal's daily answer and urge rating

Status: built 2026-11-25; questions settled with Jan 2026-11-20. Issue: [#37](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/37). Step 5 of the front-end hookup. The API side is built ([`api/specs/quitting-goals.md`](../../api/specs/quitting-goals.md)), and ADR-010 already puts both writes in the queue ([043b](043b-stored-week-and-queue.md) left them for this spec to add).

## Objective

A quitting goal gets a quiet daily held-or-not answer and an optional urge rating. The person can give or change them any time, offline included. Nothing asks for them, and a day with no answer is unknown, never a slip.

References: [flow 2, quitting goal](../../docs/flows.md#flow-2-set-a-goal-and-its-milestones), [data model: quit_days](../../docs/data-model.md#quit_days), [product rules: tone and prompts](../../docs/product-rules.md#tone-and-prompts).

### What exists afterwards

1. **Today** has one quiet row per active quitting goal, under the tasks (decision 1): its label and two choices, **Held** and **Slipped** (decision 2). An answered day shows the answer, and tapping the row again lets the person change or clear it. The row isn't a task: it isn't counted in "1 of 4 done", in the cap, or in the bank.
2. **The urge rating** appears beside the answer once a day is answered: **Low · Some · Strong**, all optional (decision 3). It can be changed or cleared.
3. **An opened day** (from Week) has the same row for that day, so a day missed can be filled in later. Days in the future offer nothing.
4. **The goal's page** replaces "Since Nov 3" with the record: "12 days held" (or "12 days held · 2 not answered" while `unknownInRun` is above 0), and the last 28 days, newest first, each reading Held, Slipped or a dash. Tapping a day answers, changes or clears it. Recent urge ratings sit on their days.
5. **Offline,** every answer and rating shows at once and is sent later, as check-offs are (ADR-010). Four new queue kinds (answer, clear answer, rate, clear rating), each naming its goal and day and stating its end result, each with a replay rule over the week document's `quittingGoals[].days`.
6. **Goal page offline:** an answer given there shows on its day at once. The run's count ("12 days held") is the server's: it updates when the goal is read again after the queue empties (decision 4).
7. **The mock** keeps quit days and urge ratings and returns them in the week read and the goal read, so tests and `npm run dev:mock` work.

### Accepted until later

- **"The urge has stayed low."** The issue says the app *may* note it, but the API has no such fact and nothing needs it yet. It is left out (decision 5).
- Reaching the goal stays the person's own tap on the goal page (End goal → Reached), as now.

## Scope

**In:**

- `src/api/`: client functions `answerQuitDay`, `clearQuitDay`, `rateUrge`, `clearUrgeRating` (real and mock); the mock's quit-day store; `quittingGoals` in the mock week; `quitRecord` in the mock goal read.
- `src/api/queue.ts`: the four kinds. `src/domain/replay.ts`: their rules.
- `src/domain/`: what the row and the record show (wording, run line, the 28 days), with no React imports.
- `src/hooks/useDay.ts` (the row on Today and an opened day), `useGoal.ts` (the record).
- `src/components/QuitDayRow.tsx` (name to settle in the plan), `src/screens/Day.tsx`, `GoalDetail.tsx`.
- Docs: this repo's `CLAUDE.md` (the list of what's queued), `docs/screens/README.md` (Today, Goal detail, and the "Not yet on screen" line), `docs/flows.md` flow 2 if the wording settles anything, ADR-010's "Built" notes.

**Out:**

- Any reminder, badge or count of unanswered days anywhere but the goal page.
- Quit days on Week (decision 1).
- Anything on the API.

## Commands

As spec 043a.

## Code style

As spec 042: logic in `domain/` and hooks, components only render. Any sheet uses the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`).

## Testing strategy

- **`domain/`:** the row's state for unanswered, held, slipped and a future day; the run line with and without unknown days; the 28 days' wording; the four replay rules, including a rule that does nothing when its goal isn't in the document.
- **Hooks and screens:** answering, changing and clearing on Today and an opened day, offline via the queue; the row never changes "1 of 4 done"; the goal page's record and answering a past day; nothing shows for a building or one-off goal.
- **Manual, by a Sonnet agent at phone width against the local API:** answer today on Today; rate the urge; change it, then clear it; open last Monday from Week and answer it; on the goal page answer a day two weeks back; go offline, answer, reload offline (it's still shown), come back online (it sends). Goals it makes are named "Verification: …".

## Boundaries

- **Always:** an unanswered day reads as a dash or nothing, never as a slip; the row never counts as a task.
- **Ask first:** any wording that judges beyond "Slipped" ("failed", "broke your streak").
- **Never:** ask for an answer, show a count of missed days on Today, or store a streak on the phone.

## Success criteria

- [x] Any day from the goal's start to today can be answered, changed and cleared, from Today, an opened day or the goal page.
- [x] An urge rating sits beside the answer, optional, changeable and clearable.
- [x] A day with no answer reads as unknown, and nothing asks about it.
- [x] The row isn't counted in the day's tasks, the cap or the bank.
- [x] The goal page shows the current run and recent urge ratings, from the API's record.
- [x] Answers and ratings work offline through the queue.
- [x] API client functions, mock and tests added; docs updated.

## Settled with Jan, 2026-11-20

As recommended, except decision 2.

1. **Where the daily answer sits** (the issue asks this to be settled first). Recommended: **Today and the goal page**. Today is where it's quick, many times a day, and the goal page is where older days get filled in. An opened day from Week gets the row too, since it's Today's screen. Week itself shows nothing extra. The alternative, the goal page only, keeps Today to tasks but makes the daily answer three taps away.
2. **The two answers' wording.** The issue says "held or slipped". "Slipped" leans toward shame language. Recommended: **Held** and **Not today**, matching the app's "not yet". **Settled: Held and Slipped,** as the issue has it. The goal page's run line: "12 days held".
3. **When the urge rating shows** ("on some days"). Recommended: **once a day is answered, always offered and never asked**: Low · Some · Strong beside the answer, which the person can ignore. The alternative, showing it only on some days (every third day, say), is the app deciding when to ask, and that is close to a prompt.
4. **The goal page offline.** Recommended: answers given there go through the queue like Today's. The day shows its answer at once, and the run's number waits for the next read, since only the server works it out. The alternative, working the run out on the phone, duplicates a server rule (ADR-008).
5. **"The urge has stayed low."** Recommended: **leave it out** for now. The API doesn't send it, and the person marks the goal reached either way. It can come with a later API change if wanted.

## What changed while building

Settled with Jan when the plan was written (2026-11-25):

- **Clear means back to unknown:** clearing an answer also clears that day's urge rating, so a hidden rating can't come back when the day is answered again.
- **The row shows on a day with nothing planned,** below "Nothing planned".
- The component is `components/QuitDayRow.tsx`; the goal page's day opens `components/QuitDaySheet.tsx` with the same controls. A run with no held days reads "No days held yet".
- The mock has no quitting goal of its own: make one with the Add sheet to try it with `npm run dev:mock`.
