# Implementation Plan: Recurring items get a structured schedule (#34)

Issue: [#34](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/34), no spec. The contract and its decisions are in the API's [`recurring-items` spec](../../api/specs/recurring-items.md). Tasks: [`todo.md`](todo.md). (The plan for #41 is in git history.)

## Overview

The mock's recurring item becomes the API's `RecurringItem`: a `schedule` (weekly on a weekday, monthly on a day, or flexible), `startsOn`, `fromGoalId` and `aspirationId: null` for Keep life running. `repeatRule`, `fixedDay` and `nextDue` go. The repeat text ("Every Tuesday") is worded from the schedule in one place. What you see and pick on every screen stays the same. Screens keep running on mock data; they move to the API in #42.

## Decisions

- **One wording module.** `domain/recurring.ts` holds `repeatText(schedule)` and `isFixedDay(schedule)`. Upkeep, an aspiration's page, Today's fixed-day mark and the form's option labels all use it.
- **The form keeps its pickers.** An option's value still names a choice ("weekday:2"); it's read back as a `Schedule` instead of the old `RepeatChoice`, which goes. Weekdays are names, as the API sends them.
- **`startsOn` is today** for every kind, with no date picker. The API reads it as "can be due from".
- **`nextDue` goes.** Nothing shows it; week turnover works out when an item is due.
- **Keep life running is `aspirationId === null`.** The mock's retire with "keep" sets items' `aspirationId` to null.
- **The type swap is one commit.** Replacing `RecurringItem` breaks every reader at once, so tests, mock and readers change together to keep each commit building. It's mechanical.

## Task list

- [ ] Task 1: Word the repeat from a schedule
- [ ] Task 2: Use the generated RecurringItem everywhere
- [ ] Task 3: Check the screens at iPhone width

Checkpoint after task 2: build, lint and tests pass.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A screen words a repeat differently from before | Low | Task 1's tests use the strings the screens show today; task 3 looks at them. |
| Task 2 is large | Med | Mechanical; the type checker finds every reader. |

## Settled

- **The fourth criterion is split out** (Jan, 2026-11-19): the app has no offer yet to keep a reached goal's practice, so `fromGoalId` stays null here. The offer is its own issue.
