# Spec: On a day, in the Add sheet

Status: built 2026-11-25 (plan in `tasks/plan.md`); decision 3 settled with Jan on 2026-11-23, decisions 1 and 2 and the form's order (Goal last) on 2026-11-25. Issue: [#79](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/79). The first front-end piece of the scheduling brief. Needs API [#50](https://github.com/jan-mcsparin/goals-to-actions-api/issues/50) ([`api/specs/on-a-day.md`](../../api/specs/on-a-day.md)). Built after step 5 (017 → 037 → 076 → 038).

## Objective

The Add sheet's Task tab can put a task on any day from today on, with an optional time, and it stays there. Today it can only go on today or in the bank, and a due date further out waits on the upcoming list.

References: [brief](../../docs/briefs/scheduling-and-other-weeks.md) ("On a day"); design [`scheduling.png`](../../docs/screens/scheduling.png), panel "Add: On a day"; [flow 3](../../docs/flows.md), step 2.

### What exists afterwards

1. **When is one choice of three:** **On today · In the bank · On a day**, a segmented control in that order, replacing "Put it". On today is preselected when the sheet opens from Today, In the bank elsewhere (decision 11, unchanged).
2. **On a day shows Day and Time (optional)** side by side, where the due date and time of day were. Both hidden otherwise.
   - **Day:** a date input, today or later (`min` today), empty until chosen. Save stays disabled until there's a day.
   - **Time (optional):** an "at" time. It sends `timeOfDay: { kind: 'at', time }`.
   - Under them: "It stays on that day, and the rest of the day is planned around it."
3. **Due date and Time of day are hidden on On a day** (the day is the constraint), and shown as now for the other two. Switching back and forth keeps what was typed in each; only the fields shown are sent (decision 1).
4. **Goal** stays as it is, for all three.
5. **Saving says where it went.** On a day: "Set for Sat, Dec 12." On a day that is today reads "Added to today.", as On today does. The other lines are unchanged. The line comes from the server's answer, as now; when the add is queued, from the predicted place (decision 2).
6. **Offline:** the add is queued as now. A day in a stored week (this week, or next once open) shows on it at once (`predictedPlace`, unchanged). A day further out isn't shown anywhere until the server has it; the line still says "Set for …".
7. **Mock:** `addTask` with a day in a later week stores the task in that week, on that day, so tests and `npm run dev:mock` work (the mock imitates the server's answer).

## Scope

**In:**

- `src/domain/add.ts`: `Placement` gains `'onADay'`; `TaskDraft` gains `day` and `atTime`; `taskInput` sends `day` and the "at" time for On a day, and leaves out the due date and time of day; `taskReady` needs a day for On a day; `taskConfirmation` gains "Set for Sat, Dec 12." (with `dayLabel` or a short weekday-and-date helper beside it).
- `src/components/TaskForm.tsx` (and `AddSheet.css`): the segmented When, the Day and Time row, the note. When goes under the title, as in the design, and Goal last.
- `src/hooks/useAdd.ts`: the confirmation for a queued add with a day beyond the stored weeks.
- `src/api/mockStore.ts` or `mockData.ts`: a later week's pinned task.
- `src/api/openapi.ts` regenerated (descriptions only).
- Tests: `domain/add.test.ts`, `components/AddSheet.test.tsx`, `hooks/useAdd.test.tsx`.
- Docs: `docs/screens/README.md` (Add sheet; drop "not built" for On a day), `docs/flows.md` flow 3 step 2 and "Later weeks", the brief's status line.

**Out:**

- Seeing a later week's tasks (#80), moving or removing them (#82), Coming up (#83).
- Changing an existing task's day from the Add sheet: the sheet only adds.

## Decisions

Decision 3 settled with Jan, 2026-11-23. Decisions 1 and 2 follow the design and the existing replay; they're confirmed when the plan is written.

1. **The When control is a segmented control,** matching the design, not radio buttons. It's still one choice, reachable by keyboard, announced as a group named "When".
2. **A queued add's line is predicted the way its place is.** `taskConfirmation` already takes the place; a day beyond the stored weeks predicts `{ week: mondayOf(day), day }` for the line only, and `replay` ignores a week it doesn't store, as now.
3. **On a day doesn't preselect a day.** An empty Day keeps Save off, so nothing lands on a day the person didn't pick.

## Commands

```
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm run api:types
npm test
npm run lint
npm run build
```

## Code style

As spec 042: wording and the request body in `domain/`, the save in `useAdd`, the form only renders.

```ts
export function taskInput(draft: TaskDraft, today: string): NewTask {
  const input: NewTask = { title: draft.title }
  if (draft.goalId) input.goalId = draft.goalId
  if (draft.placement === 'onADay') {
    input.day = draft.day
    if (draft.atTime) input.timeOfDay = { kind: 'at', time: draft.atTime }
    return input
  }
  ...
}
```

## Testing

- `domain/add.test.ts`: the body for each When (On a day leaves out a typed due date); ready only with a day; each confirmation line, including On a day on today.
- `AddSheet.test.tsx`: When's three choices and the preselection from Today and elsewhere; Day and Time show only on On a day; saving a task on Dec 12 at 3 p.m. shows "Set for Sat, Dec 12."
- `useAdd.test.tsx`: a queued add for a day past the stored weeks says "Set for …" and doesn't appear on the stored week.
- Then a sonnet agent checks the sheet at iPhone width against the real API (the dev server and API are already running).

## Boundaries

- **Always:** `nvm use` first; tests, lint and build before saying it's done; docs in the same PR; regenerate types from the API, never hand-write them.
- **Ask first:** a new dependency (a date picker library is not expected: the native date input is used).
- **Never:** decide on the phone where a task lands beyond showing a prediction (ADR-008).

## Success criteria

- A task saved On a day three weeks out has, on the real API, a hand-placed row on that day, and the sheet said "Set for …".
- On today and In the bank behave and read exactly as before.
- Tests, lint and build pass.

## Open questions

None.

## Checked

By a Sonnet agent at 390px against the local API, 2026-11-25, on tasks named "Verification: …". Opened from Today, the form read Title, When (On today selected), Due date, Time of day, Goal; opened from Week, In the bank was selected. On a day swapped in Day and Time (optional) side by side with the note. Save stayed off until there was a day, and switching back and forth kept both sides. "Verification: dentist" on Dec 16 at 3 p.m. said "Set for Wed, Dec 16.", sent `day` and an "at" time with no due date, and came back as a hand-placed row in the week of Dec 14, not shown on Today or Week. A day of today said "Added to today."; In the bank and On today read as before. No horizontal scroll and no app errors in the console. Left in place: "Verification: dentist" (Dec 16), "Verification: today on a day", "Verification: bank" and "Verification: on today" (maybe two of the last).
