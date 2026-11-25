# Implementation Plan: On a day, in the Add sheet (#79)

Spec: [`../specs/079-on-a-day.md`](../specs/079-on-a-day.md). Issue: [#79](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/79). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

The Task tab's placement becomes **When: On today · In the bank · On a day**. On a day takes a Day (today or later, required) and an optional "at" Time, hides Due date and Time of day, and the task stays on that day, in any week from the current one on (API #50). Saving says "Set for Sat, Dec 12.", or "Added to today." when the day is today.

## Architecture decisions

- **`domain/add.ts`:** `Placement` gains `'onADay'`; `TaskDraft` gains `day` and `atTime` (kept apart from `dueDate`/`time`, so switching loses nothing). `taskInput` sends `day` and `timeOfDay: { kind: 'at' }` for On a day, and leaves out the due date and time of day. `taskReady(draft)` needs a day for On a day.
- **`taskConfirmation(task, today)`:** a planned day that is today reads "Added to today."; any other planned day reads "Set for Sat, Dec 12." (weekday, month, day; the year when it isn't this year, as `dayLabel` does). The bank lines are unchanged.
- **`predictedPlace` follows API #50:** a `day` from today on, in the current week or later, predicts `{ week: mondayOf(day), day }`, whether that week is stored or open. With nothing stored, a day from today on is still predicted from the day. A day before today or before the current week stays the current week's bank. `replay` already ignores a place in a week it isn't replaying, so a day past the stored weeks shows nowhere until the server has it, and the line still says "Set for …" (decision 2).
- **The form:** Title, **When** (a segmented control: native radios in a `role="radiogroup"` labelled "When", styled as segments like the design and Settings' intensity), then either Day and Time (optional) side by side with the note "It stays on that day, and the rest of the day is planned around it.", or Due date and Time of day as now; then Goal, last (settled with Jan, 2026-11-25: the scheduling design puts When under the title and leaves Goal out).
- **The mock's `addTask`:** a day from today on in any week from this one on is placed there by hand (was: open weeks only).
- **Types:** `npm run api:types` picks up #50's descriptions; no type changes.

## Decisions (confirmed with this plan)

1. When is a segmented control, one radio group named "When" (spec decision 1).
2. A queued add's line comes from its predicted place; a day past the stored weeks predicts its own week for the line, and replay ignores it (spec decision 2).
3. On a day doesn't preselect a day (settled 2026-11-23).

## Tasks

1. **The rules.** `domain/add.ts` (+test): the draft, `taskInput`, `taskReady`, `taskConfirmation`'s "Set for …". `domain/replay.ts` (+test): `predictedPlace` for later weeks and with nothing stored. (S)
2. **The mock places a later week's day.** `api/client.ts` (+test): `addTask` with a day three weeks out returns a hand-placed task on that day and week; a day before today still goes to this week's bank. (S)
3. **The form.** `TaskForm.tsx`, `AddSheet.css`, `AddSheet.test.tsx`: the three choices and their preselection; Day and Time only on On a day; Save off until a day; switching keeps what was typed; saving Dec 12 at 3 p.m. shows "Set for Sat, Dec 12."; On today and In the bank read as before. (M)
4. **A queued add past the stored weeks.** `hooks/useAdd.test.tsx`: offline, a day past the stored weeks says "Set for …" and doesn't appear on the stored week; a day in this week shows on it at once. (S)
5. **Types, docs and the check.** `npm run api:types`; `../docs/screens/README.md`, `../docs/flows.md` flow 3 step 2 and "Later weeks", the brief's status line, the spec's status and the specs index; a sonnet agent checks the sheet at iPhone width on the real API (a task three weeks out lands on its day). (S)
