# Spec: Edit a recurring item

Status: draft 2026-11-20; open questions below. Issue: [#76](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/76). Step 5 of the front-end hookup, built before [038](038-delete-mistakes.md), whose recurring-item delete goes in this spec's sheet (038, decision 2). The API side is built ([`api/specs/recurring-items.md`](../../api/specs/recurring-items.md)): `updateRecurringItem`, `turnOffRecurringItem` and `turnOnRecurringItem`.

## Objective

A recurring item can be fixed after it's added: its name, its repeat and which aspiration it's under (or none, for Keep life running). It can also be paused and resumed, the way a goal can. Today an item can only be added, and its rows don't open anything.

References: [flow 4, maintenance](../../docs/flows.md) (step 3, "Adding one"), flow 7 item 4 (turning an item off and on), [data model: recurring_items](../../docs/data-model.md#recurring_items).

### What exists afterwards

1. **A recurring row opens its sheet** wherever it's listed: the Recurring section of an active aspiration's page, and the Recurring section of Keep life running (decision 1).
2. **The sheet is the Add sheet's recurring form, filled in** (decision 2): the name, **Fixed day** or **Flexible** with its repeat, and the aspiration picker (active aspirations, or none). **Save** and **Cancel**. Save is enabled only when something has changed and the name isn't empty.
3. **What an edit changes,** as the API does it: nothing already in the week moves, and no task is made or renamed. The change starts with the item's next period. The sheet says so in one quiet line under the form: "Changes start from the next time it comes round. What's in this week stays as it is." (decision 3)
4. **Pause and Resume** (decision 4), at the bottom of the sheet, under the form. They act at once, without asking: pausing takes the item's open tasks off the days and out of the bank in every open week, and resuming brings them back to the bank, as for a goal. A paused item reads "Paused" in place of its repeat on both lists, and it stays listed. (Keep life running lists only active items today; it gains the paused ones.)
5. **Saving waits for the server,** as a goal's Pause does. It isn't queued (ADR-010). On a failure the sheet stays open with what was typed and shows "Couldn't save that. Try again." On success the sheet closes, and the list is read again so the row shows the new name and repeat, or moves to another aspiration's page or to Keep life running.
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
- Docs: `docs/screens/README.md` (Aspiration and Keep life running: rows open the sheet), and `docs/flows.md`. Its planning step 5 and flow 4 say a changed item's work is placed as it arrives, but the API places nothing on an edit, and the docs should say so. Update the planner spec's line in `api/specs/planner.md` the same way, or note it there.

**Out:**

- Delete (038).
- Turning a goal's kept-up practice back into a goal, or changing `fromGoalId`.
- Repeats the Add sheet doesn't offer (yearly, a time of day).
- Anything on the API.

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
- **Manual, by a Sonnet agent at phone width against the local API,** on an item it creates named "Verification: …": rename it, change Fixed to Flexible, move it from an aspiration to Keep life running and back; pause it and check its open task left Today and the bank, then resume it and check the task is back in the bank; offline, Save fails with the message and nothing changes. It deletes nothing (delete comes with 038).

## Boundaries

- **Always:** keep `startsOn` as the item has it; read the lists again after a change, rather than guessing where the row goes.
- **Ask first:** changing what an edit does to this week's tasks (that's the API's rule, and changing it is an API change).
- **Never:** queue these writes; ask before Pause (it's undone by Resume, as for a goal).

## Success criteria

- [ ] A recurring item opens for editing from an aspiration's page and from Keep life running.
- [ ] Its name, repeat (fixed day or flexible) and aspiration (or none) can be changed and saved, with `updateRecurringItem`.
- [ ] The sheet says the change starts from the next time it comes round, and nothing in the week moves.
- [ ] It can be paused and resumed; a paused item stays listed as "Paused".
- [ ] API client functions, mock and tests added; `docs/flows.md` and `docs/screens/README.md` updated.

## Open questions

1. **Where the sheet opens from.** Recommended: an active aspiration's page and Keep life running, the two places the issue names. The Aspirations tab's cards list items too, but a card opens its aspiration, so leave it.
2. **One form for adding and editing.** Recommended: reuse `RecurringForm` in a new sheet, filled in from the item, so the two can't drift apart. The alternative, a separate edit form, is more code for the same fields.
3. **The issue says the week places changed work as it arrives.** The API as built does the opposite: "An edit to a recurring item makes nothing and moves nothing; it takes effect from the item's next period" (`api/specs/week-turnover.md`). Recommended: **follow the API**, show the quiet line in item 3, and correct `docs/flows.md`, which still says otherwise. If you want an edit to move this week's task (say, the trash moved from Tuesday to Thursday), that's an API change first.
4. **Pause/Resume, or Turn off / Turn on.** The API and flows say "turn off". The aspiration page already shows "Paused". Recommended: **Pause / Resume and "Paused"**, matching goals and what's on screen.
5. **The retired aspiration's paused items** (see Accepted until later). Recommended: leave them out until someone needs to resume one from there.
