# Spec: Delete what was made by mistake

Status: built 2026-11-25 (plan in `tasks/plan.md`); questions settled with Jan on 2026-11-20, and the plan's on 2026-11-25. Issue: [#38](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/38). Step 5 of the front-end hookup. The API side is built ([`api/specs/delete.md`](../../api/specs/delete.md)): five `DELETE` routes, and the server decides what goes with each.

## Objective

Anything made by mistake can be deleted: a task, a milestone, a goal, an aspiration or a recurring item. Delete is quiet, asks once, and can't be confused with Drop, which is a decision and stays in history.

References: [data model: drop and delete](../../docs/data-model.md#drop-and-delete), [flow 7, deleting](../../docs/flows.md#flow-7-rollovers-and-light-reviews) (item 9), [product rules](../../docs/product-rules.md).

### What exists afterwards

1. **Where Delete sits** (decision 1). It's always the last choice, in plain text, never a red button on the screen itself:
   - **A task:** the last item in a task's More menu on Today or an opened day, and in the sheet a bank task opens on Week.
   - **A milestone:** on the goal page, any milestone row opens a small sheet with **Delete milestone** (and Check in, when it's Next).
   - **A goal:** the last action on its page, under Pause · End goal.
   - **An aspiration:** at the bottom of its edit sheet.
   - **A recurring item:** see decision 2.
2. **It asks once,** in a sheet that says what goes with it (decision 3), with **Delete** and **Cancel**:
   - Task: "Delete “Pay rent”? It goes as if it was never made." (decision 4)
   - Milestone: "Delete this milestone? Its check-ins go with it."
   - Goal: "Delete “Be strong”? Its tasks, milestones and check-ins go with it. There's no undo."
   - Aspiration: "Delete “Be fit”? Its goals and recurring items stay, with no aspiration."
   - Recurring item: "Delete “Laundry”? Its open tasks go with it; the ones done stay in your history."
3. **After deleting,** the thing is gone from every screen and count. The week is read again. A deleted goal or aspiration leaves its page: a goal goes back to where it was opened from, and an aspiration goes to the Aspirations tab. Each screen's stored response for it is forgotten (as a 404 already does, spec 043c).
4. **It needs a connection** (ADR-010: delete isn't queued). Offline, or on any failure, nothing changes and "Couldn't delete that. Try again." shows. A 404 (already deleted on another device) counts as done.
5. **Mock:** the five deletes, taking what the API takes, so tests and `npm run dev:mock` work.

### Accepted until later

- No undo (settled Nov 19, `docs/flows.md`).

## Scope

**In:**

- `src/api/`: `deleteTask`, `deleteMilestone`, `deleteGoal`, `deleteAspiration`, `deleteRecurringItem` (real and mock, the mock cascading as `api/specs/delete.md`'s table).
- `src/domain/`: each confirmation's wording.
- `src/hooks/`: `useDay`, `useWeek`, `useGoal`, `useAspiration` (and whichever hook holds recurring items, decision 2) gain a delete that waits for the server, then reloads or leaves the page.
- `src/components/DeleteSheet.tsx` (one sheet, its wording passed in), `TaskMenu.tsx`, `DayPickerSheet.tsx`, `AspirationEditSheet.tsx`; a milestone sheet in `GoalDetail.tsx`.
- Docs: `docs/screens/README.md` (each screen's Delete, and the "Not yet on screen" line), `docs/flows.md` item 9 ("No screen offers delete yet" goes).

**Out:**

- Deleting a check-in, a weekly target, a quit day (clearing it is #37) or a whole week.
- Anything on the API.

## Commands

As spec 043a.

## Code style

As spec 042. Sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`). Delete is never the first or default button.

## Testing strategy

- **`domain/`:** each confirmation's wording.
- **Hooks and screens:** each of the five asks once, sends, and the thing disappears; Cancel sends nothing; a failure leaves everything as it was, with the message; a 404 counts as done; a deleted goal or aspiration leaves its page; deleting an aspiration leaves its goals under Other goals and its items under Keep life running.
- **Manual, by a Sonnet agent at phone width against the local API,** on things it creates named "Verification: …": delete one of each; check each is gone from Today, Week, the Aspirations tab and Keep life running, and that a deleted goal's tasks left the week; offline, delete fails with the message and nothing changes.

## Boundaries

- **Always:** ask once before deleting; say what goes with it.
- **Ask first:** offering delete anywhere beyond the five places in item 1.
- **Never:** delete without the sheet, queue a delete, or word Delete so that it reads like Drop.

## Success criteria

- [x] Delete is offered, quietly, on a task, a milestone, a goal, an aspiration and a recurring item.
- [x] It asks once, saying what goes with it.
- [x] A deleted thing disappears from every screen and count.
- [x] Deleting an aspiration leaves its goals and recurring items without an aspiration.
- [x] Delete and Drop are worded so they can't be confused.
- [x] API client functions, mock and tests added; docs updated.

## Settled with Jan, 2026-11-20

All as recommended.

1. **The places in item 1.** Recommended as listed. A task has no page of its own, so its More menu and the bank's sheet are where it can be reached. A milestone row isn't tappable today unless it's Next, so this makes every milestone row open a small sheet.
2. **Where a recurring item's Delete goes.** Today a recurring item can only be added: its rows on an aspiration's page and on Keep life running don't open anything. #76 (edit a recurring item) will add a sheet that opens from those rows. Recommended: **build #76 first, or together with this**, and put Delete at the bottom of its edit sheet, as for an aspiration. The alternative, a delete-only sheet now that #76 later replaces, builds a screen twice.
3. **The wording in item 2.** Recommended as written: name the thing, say what goes with it, and say "There's no undo" only for a goal, where the most goes with it. The front end doesn't know how many tasks a goal has without another read, so there are no counts.
4. **Telling Delete from Drop.** Drop is offered only on the "Still matter?" card, never in a task's menu, so the two never sit side by side. Recommended: the menu item reads **Delete (made by mistake)** and the sheet doesn't mention Drop. The alternative adds a line to the task sheet: "To decide not to do it, wait for Still matter? and Drop it.", which explains more but reads like a lesson.
5. **Deleting a task the app placed** (a goal session or a recurring task). The API deletes it, and its period's number stays taken, so it isn't made again (`api/specs/delete.md`). Recommended: offer Delete on these too, with the same sheet, since the API allows it and one made by a mistaken target is still a mistake.

## Settled while planning, 2026-11-25

- **A fixed-day task's ⋯ menu holds only Delete.** Moving one for a single week (a holiday moves trash day) goes in #82's spec and joins that menu; the API refuses it today.
- **A goal's Delete shows in every state**, and **a task's on past days too**, wherever its menu shows.
- **Every milestone row opens a small sheet** (Check in when it can be, and Delete); the goal's own row still opens Check in directly.

## Checked

By a Sonnet agent at 390px against the local API, 2026-11-25, on items named "Verification: …": a task deleted from Today (Delete last in its menu; Cancel changed nothing; the count dropped) and one from the Week bank's sheet; a fixed-day task's menu held only Delete; a milestone deleted from its row's sheet (Check in only on Next), the count and Next moved on; a recurring item deleted from an aspiration's page and a fixed one from Keep life running, their tasks gone from Week; a goal deleted ("There's no undo."), back to where it was opened, its tasks gone from Week and Today; an aspiration deleted, landing on the tab with its goal under Other goals. Offline, Delete kept the task with "Couldn't delete that. Try again." Every sheet put Cancel first. No horizontal scroll and no app errors in the console. Left in place: one goal, "Verification" (line "orphan goal"), under Other goals.
