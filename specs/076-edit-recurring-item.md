# Spec: Edit a recurring item

Status: built 2026-11-25; questions settled with Jan 2026-11-20. API [#49](https://github.com/jan-mcsparin/goals-to-actions-api/issues/49), which makes an edit move this week's work, came first. Issue: [#76](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/76). Step 5 of the front-end hookup, built before [038](038-delete-mistakes.md), whose recurring-item delete goes in this spec's sheet (038, decision 2). The API side is built ([`api/specs/recurring-items.md`](../../api/specs/recurring-items.md)): `updateRecurringItem`, `turnOffRecurringItem` and `turnOnRecurringItem`.

## Objective

A recurring item can be fixed after it's added: its name, its repeat and which aspiration it's under (or none, for Keep life running). It can also be paused and resumed, the way a goal can. Today an item can only be added, and its rows don't open anything.

References: [flow 4, maintenance](../../docs/flows.md) (step 3, "Adding one"), flow 7 item 4 (turning an item off and on), [data model: recurring_items](../../docs/data-model.md#recurring_items).

### What exists afterwards

1. **A recurring row opens its sheet** wherever it's listed: the Recurring section of an active aspiration's page, and the Recurring section of Keep life running (decision 1).
2. **The sheet is the Add sheet's recurring form, filled in** (decision 2): the name, **Fixed day** or **Flexible** with its repeat, and the aspiration picker (active aspirations, or none). **Save** and **Cancel**. Save is enabled only when something has changed and the name isn't empty.
3. **What an edit changes** is the API's rule (API #49, decision 3). This week's work follows the edit: open tasks are renamed, the ones the app placed move to the new day (or are added or removed when a flexible count changes), and anything placed by hand or done stays. The phone shows the result: after saving, the week is read again, so Today and Week show where each task landed. The sheet adds no line about it.
4. **Pause and Resume** (decision 4), at the bottom of the sheet, under the form. They act at once, without asking: pausing takes the item's open tasks off the days and out of the bank in every open week, and resuming brings them back to the bank, as for a goal. A paused item reads "Paused" in place of its repeat on both lists, and it stays listed. (Keep life running lists only active items today; it gains the paused ones.)
5. **Saving waits for the server,** as a goal's Pause does. It isn't queued (ADR-010). On a failure the sheet stays open with what was typed and shows "Couldn't save that. Try again." On success the sheet closes, and the list and the week are read again so the row shows the new name and repeat, or moves to another aspiration's page or to Keep life running.
6. **Room for Delete:** the sheet's bottom has space for 038's **Delete**, below Pause.
7. **Mock:** the three writes, with pausing setting the item's open tasks aside and resuming returning them, so tests and `npm run dev:mock` work.

### Accepted until later

- **A retired aspiration's page** shows the items its retiring paused (Retired page: "what it paused"). Their rows don't open the sheet yet. Resuming one there makes it maintenance (the API's rule), which would need its own wording. Left out.
- **A next due day** isn't shown anywhere (the API doesn't send one, by design).

## Scope

**In:**

- `src/api/`: `updateRecurringItem`, `turnOffRecurringItem`, `turnOnRecurringItem` (real in `realPlan.ts`, and mock). `getUpkeep` (real and mock) keeps paused items.
- `src/domain/add.ts` (or `recurring.ts`): a draft from an existing item (the inverse of `scheduleOf`), the edit body from a draft (`startsOn` kept as it is: the API doesn't need a new start when the weekday changes), and "has it changed".
- `src/domain/upkeep.ts`: a paused row reads "Paused".
- `src/hooks/useRecurringEdit.ts` (name to settle in the plan): open, edit, save, pause, resume; `useAspiration` and `useUpkeep` read again after a change.
- `src/components/RecurringEditSheet.tsx` wrapping `RecurringForm.tsx`; `RecurringForm` gains whatever it needs to be shown filled in (decision 2). `src/screens/Aspiration.tsx` and `Upkeep.tsx`: the rows become buttons.
- Docs: `docs/screens/README.md` (Aspiration and Keep life running: rows open the sheet). What an edit does to the week goes in `docs/flows.md` with API #49.

**Out:**

- Delete (038).
- Turning a goal's kept-up practice back into a goal, or changing `fromGoalId`.
- Repeats the Add sheet doesn't offer (yearly, a time of day).
- Anything on the API (API #49 comes first).

## Commands

As spec 043a:

```
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm test
npm run lint
npm run build
```

## Project structure

One new sheet, one new hook, as in Scope. No new folders.

## Code style

As spec 042: the draft and its wording in `domain/`, the save in a hook, the sheet only renders. Sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`), like `AspirationEditSheet`:

```tsx
<RecurringEditSheet
  open={editing !== undefined}
  edit={recurringEdit}          // from useRecurringEdit: draft, canSave, message, save, pause, resume
  onClose={() => setEditing(undefined)}
/>
```

## Testing strategy

- **`domain/`:** a draft from each schedule kind (weekly on a weekday, monthly on a day, each flexible option) comes back as the same schedule; the edit body keeps `startsOn`, `fromGoalId` isn't sent; "has it changed" for each field; a paused row reads "Paused".
- **Hooks and screens:** a row opens the sheet filled in; Save is off until something changes; saving a new name, a new repeat, and a move to another aspiration or to none; the list reads again and the row lands in its new place; a failed save keeps the sheet and its text with the message; Pause and Resume, and the paused row on both lists.
- **Manual, by a Sonnet agent at phone width against the local API,** on an item it creates named "Verification: …": rename it and check its open task on Week is renamed; change its day and check its task moved; change Fixed to Flexible; move it from an aspiration to Keep life running and back; pause it and check its open task left Today and the bank, then resume it and check the task is back in the bank; offline, Save fails with the message and nothing changes. It deletes nothing (delete comes with 038).

## Boundaries

- **Always:** keep `startsOn` as the item has it; read the lists again after a change, rather than guessing where the row goes.
- **Ask first:** working out on the phone where an edited item's tasks go (the API decides, ADR-008).
- **Never:** queue these writes; ask before Pause (it's undone by Resume, as for a goal).

## Success criteria

- [x] A recurring item opens for editing from an aspiration's page and from Keep life running.
- [x] Its name, repeat (fixed day or flexible) and aspiration (or none) can be changed and saved, with `updateRecurringItem`.
- [x] After an edit, Today and Week show this week's tasks where the API moved them.
- [x] It can be paused and resumed; a paused item stays listed as "Paused".
- [x] API client functions, mock and tests added; `docs/flows.md` and `docs/screens/README.md` updated.

## Settled with Jan, 2026-11-20

As recommended, except decision 3.

1. **Where the sheet opens from.** Recommended: an active aspiration's page and Keep life running, the two places the issue names. The Aspirations tab's cards list items too, but a card opens its aspiration, so leave it.
2. **One form for adding and editing.** Recommended: reuse `RecurringForm` in a new sheet, filled in from the item, so the two can't drift apart. The alternative, a separate edit form, is more code for the same fields.
3. **The issue says the week places changed work as it arrives.** The API as built does the opposite: "An edit to a recurring item makes nothing and moves nothing; it takes effect from the item's next period" (`api/specs/week-turnover.md`). Recommended: follow the API. **Settled: an edit moves this week's work,** an API change first ([API #49](https://github.com/jan-mcsparin/goals-to-actions-api/issues/49)). Only tasks the app placed, or still in the bank, move. A task whose old day has passed moves only if it isn't done and the new day is today or later. A flexible count change acts like a weekly target change.
4. **Pause/Resume, or Turn off / Turn on.** The API and flows say "turn off". The aspiration page already shows "Paused". Recommended: **Pause / Resume and "Paused"**, matching goals and what's on screen.
5. **The retired aspiration's paused items** (see Accepted until later). Recommended: leave them out until someone needs to resume one from there.

## What changed while building

Settled with Jan when the plan was written (2026-11-25):

- **Pause and Resume close the sheet,** like Save; the row then reads "Paused" or its repeat.
- **The sheet offers only the Add sheet's repeats.** An item with one the API allows but the Add sheet doesn't offer (twice every two weeks, say) couldn't be shown; none can be made in the app today.
- **The mock's edit renames the item's open tasks but moves none:** where they go is the API's, and nothing tested here needs it imitated.
- The hook is `hooks/useRecurringEdit.ts`, the sheet `components/RecurringEditSheet.tsx`; `RecurringForm` gained an optional Cancel.

## Checked

By a Sonnet agent at 390px against the local API, 2026-11-25, on "Verification: water the plants": a rename renamed its open task; a new day moved its task (Friday to Saturday); Fixed to Flexible 2 times a week gave 2 tasks; moving it under Be fit and back moved its row each way; Pause cleared its tasks from the days and the bank and Resume brought 2 back to the bank; offline, Save kept the sheet, the typed name and "Couldn't save that. Try again." No horizontal scroll and no app errors in the console. The item is left in place, on.
