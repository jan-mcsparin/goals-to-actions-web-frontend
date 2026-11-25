# Implementation Plan: Edit a recurring item (#76)

Spec: [`../specs/076-edit-recurring-item.md`](../specs/076-edit-recurring-item.md). Issue: [#76](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/76). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

A recurring row on an active aspiration's page or on Keep life running opens a sheet: the Add sheet's recurring form, filled in, with Save and Cancel, and Pause or Resume below it. Saving and pausing wait for the server (not queued); the list is then read again. A paused item stays listed as "Paused". API #49 is built, so an edit moves this week's work on the server; the phone only reads it again.

## Architecture decisions

- **Client functions** in `realPlan.ts`: `updateRecurringItem(id, edit)` (`PATCH /recurring-items/{id}`, the whole `RecurringItemEdit`), `turnOffRecurringItem(id)`, `turnOnRecurringItem(id)` (`POST …/turn-off`, `…/turn-on`). Not queued. Mock twins in `client.ts`. Types regenerated from `../api/openapi.json` first (it also carries 038's delete, unused here).
- **The mock** keeps it small: an edit changes the item and renames its open tasks; turning off sets its waiting tasks aside in the current week (as `pauseWork` does for a retired aspiration's items); turning on returns them to the bank. It doesn't move tasks between days on an edit: the API decides that, and no test or click-through needs the mock to imitate it.
- **`getUpkeep` keeps paused items** (real and mock), so Keep life running lists them. An active aspiration's page lists its paused items too (`domain/aspiration.ts`, which today drops them on the active page).
- **`domain/add.ts`:** `recurringDraftOf(item)` (the inverse of `scheduleOf`; the picker not in use keeps its default), `recurringEditInput(draft, item)` (keeps the item's `startsOn`; `fromGoalId` isn't part of `RecurringItemEdit`), and `recurringChanged(draft, item)`. Rows read "Paused" in place of the repeat (`domain/upkeep.ts` gains `paused` like the aspiration row).
- **`hooks/useRecurringEdit.ts`:** takes the items on the screen and the screen's `reload`. `open(itemId)`, `close()`, and while open: `draft`, `change`, `canSave` (changed and named), `paused`, `message`, `save()`, `pause()`, `resume()`. Each write waits for the server; on success the sheet closes (save) or shows the new state (pause/resume), and the screen reads its record again. On failure the sheet stays with what was typed and "Couldn't save that. Try again." A second tap while a write is on its way does nothing. The aspiration picker's choices come from `getChoices()` when the sheet opens, as the Add sheet loads them.
- **Today and Week** need nothing new: they show the stored week, then read it fresh when opened (043b), which carries the API's moves.
- **`components/RecurringEditSheet.tsx`:** native `<dialog>` (`useModalDialog`, `useBackdropClose`), titled "Edit recurring", holding `RecurringForm` filled in, then Pause or Resume. `RecurringForm` gains an optional `onCancel` (shows Cancel beside Save). The sheet's bottom leaves room for 038's Delete under Pause.
- **Screens:** rows become buttons (`Aspiration.tsx`'s `RecurringSection` on the active page only; `Upkeep.tsx`). The retired page's rows stay plain (spec, Accepted until later).

## Tasks

1. **Client functions and the mock.** Regenerate types; `updateRecurringItem`, `turnOffRecurringItem`, `turnOnRecurringItem` real and mock; `getUpkeep` keeps paused items. Tests: the real requests; the mock's edit renames open tasks, off sets them aside, on brings them back to the bank; Keep life running includes a paused item. Files: `api/openapi.ts`, `api/realPlan.ts`(+test), `api/client.ts`(+test). (M)
2. **The draft, the edit body, "changed", and "Paused" rows.** `domain/add.ts`: `recurringDraftOf`, `recurringEditInput`, `recurringChanged`; `domain/upkeep.ts`: paused rows read "Paused"; `domain/aspiration.ts`: the active page keeps paused items. Tests: each schedule kind round-trips; `startsOn` kept; each field counts as a change; paused rows on both lists. (M)
3. **The hook and the sheet.** `hooks/useRecurringEdit.ts`, `components/RecurringEditSheet.tsx`, `RecurringForm`'s Cancel. Tests (hook): opens filled in; Save off until changed; save sends the body, closes and reloads; a failure keeps the draft with the message; pause and resume call the API and reload; a second tap while saving does nothing. (M)
4. **Keep life running opens the sheet.** `useUpkeep` exposes `reload` and the items; `Upkeep.tsx` rows become buttons. Tests (screen): a row opens the sheet filled in; renaming saves and the row shows the new name; moving it under an aspiration takes it off the list; pause shows "Paused". (S)
5. **An aspiration's page opens the sheet.** `useAspiration` passes `reload` and its items; `Aspiration.tsx`'s active page rows become buttons. Tests (screen): row opens the sheet; a new repeat shows on the row; moving to none takes it off the page; pause and resume; a failed save keeps the sheet and its text. (S)
6. **Docs and the check.** `../docs/screens/README.md` (Aspiration and Keep life running: rows open the sheet; paused rows); `docs/flows.md` already says what an edit does (API #49). Spec 076 marked built, specs index updated. A Sonnet agent runs the spec's manual checks at phone width against the local API. (S)

### Checkpoints

- After 2: tests, lint and build pass.
- After 5: the full suite, lint and build; the sheet works in `npm run dev:mock`.
- After 6: the Sonnet agent's check; PR "Closes #76". The docs change goes in its own PR in the parent repo.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `scheduleOf` has no option for a schedule the API holds (a monthly day past 28, a flexible count beyond the options) | Med: the sheet couldn't show it | `recurringDraftOf` falls back to the defaults only if the value has no option; tests cover each offered schedule. Items are only made through the Add sheet today, so none should exist |
| The aspiration choices fail to load | Low | As the Add sheet: the picker offers None and the item's own aspiration, with the Add sheet's note |
| Today briefly shows the stored week before the fresh read | Low | That's ADR-010's design; the fresh read lands within the load |
