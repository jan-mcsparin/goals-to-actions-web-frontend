# Implementation Plan: Ids made on the device, the phone's time zone, and the check-off's moment (#39)

Issue: [#39](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/39); no spec of its own. The rules are in [`data-model.md`: on every table](../../docs/data-model.md#on-every-table), the API's `CheckOff` (`openapi.ts`), and [ADR-004](../../docs/adr/0004-instant-open.md). Tasks: [`todo.md`](todo.md). (The plan for #48 is in git history.)

## Overview

Most of #39 arrived with earlier work:

- **The time zone:** `request.ts` already sends `X-Time-Zone` on every request, with a test.
- **Ids made on the device:** new aspirations, goals, milestones and check-ins already use `newDeviceId()`, on the mock and on the API. Recurring items and tasks still get counter ids (`rec-new-1`) in the mock.

What's left is three small changes, all before Today, Week and the bank move to the API (#42):

1. **A check-off carries the moment it was tapped.** The API's `CheckOff` is `{ completedAt, completedOn, valueLogged? }`: what the phone saw at the tap, with that day winning even if the week has closed since. Today, `useDay` makes one moment for the screen, and `checkOffTask` makes another when it saves. Once #43 queues changes, the save may happen hours later. So the hook makes the moment once and sends it.
2. **Recurring items and tasks get ids made on the device** in the mock, as everything else does. The `newId` counter goes.
3. **Settings is the API's:** just `intensity`. `weekStartsOn` and `intensitySetOn` go, and Settings still shows "Week starts Monday" as a fixed row.

**One PR**, `device-ids`, which closes #39.

## Decisions

- **`checkOffTask(taskId, checkOff: CheckOff)`**, with `CheckOff` named from the generated type in `types.ts`. A domain helper, `checkOffAt(now: Date): CheckOff`, makes it from one `Date`: the ISO moment and `toLocalDay` of the same moment. That way the optimistic change and the save can't disagree about the day.
- **`valueLogged` moves into `CheckOff`,** as the API has it. No screen sends one yet.
- **"Today follows the phone's date after a time zone change, and the week never goes backwards"** is met as far as the front end can meet it now:
  - Today is the phone's own date each time the app opens (`App.tsx`), whatever the time zone.
  - The week comes from the API, whose current week never goes backwards (`closed_through_week`). Screens read it in #42.
  - Following the date while the app stays open (overnight, or after landing somewhere new) is the `visibilitychange` refresh. That was agreed to go in with hosting (#8), when the installed app needs it.

## Task list

- [x] Task 1: The check-off carries the moment it was tapped
- [x] Task 2: Ids made on the device for recurring items and tasks
- [x] Task 3: Settings is the API's

Checkpoint after task 3: build, lint and tests pass; nothing on screen has changed; PR opened.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A test or the mock data depends on `task-new-1`-style ids | Low | The full suite runs in task 2; tests find new items by title, not id |
| Removing `intensitySetOn` hides a use | Low | The compiler finds every reader once the type is the generated one |

## Assumed, for review with this plan

1. #39 closes with this PR. The open-app date refresh stays with #8, as agreed on 2026-11-19.
