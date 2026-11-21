# Spec: Report every failed save

Status: draft 2026-11-20; questions settled with Jan the same day. Issue: [#17](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/17). Step 5 of the front-end hookup. The issue's comments hold the design (2026-11-12). This spec checks it against what has changed since: the plan screens' saves now go through the queue (043b), and every other screen opens from its stored response (043c).

## Objective

Every save that fails shows "Couldn't save that. Try again.", and the screen ends on what the server has, never on a change that was lost. This matters now that the real API is the default: saves are slow enough to overlap, and they can fail.

### What exists afterwards

1. **Saves that wait for the server** (not queued) count how many are still on their way. Each failure shows the message. Once none are left and one of them failed, the record is read again from the API, rather than guessing what to put back. This replaces:
   - `latestSave` in `useAspiration` (edit, move) and `useSettings` (intensity), where only the newest save may roll back and it puts back the whole record;
   - the immediate reload in `useGoal`, which can wipe a save still on its way.
2. **`useLoaded` gains `reload()`**, used for that read. The read goes through the stored response as any read does (043c), so a failed reload keeps what's shown.
3. **The same message twice shows twice.** `useFleetingMessage` takes an `onGone` that clears the hook's message when it fades or is tapped, so the next failure, even with the same text, is new. The clear-then-set workaround in `useSettings.exportData` goes.
4. **Two moves at once** (the issue's last case): both read the same page, the API refuses the second as already first, and the page ends on the order the API has.

### Accepted until later

- Nothing.

## Scope

**In:**

- `src/hooks/useLoaded.ts` (`reload`), `useFleetingMessage.ts` (`onGone`), `useAspiration.ts`, `useSettings.ts`, `useGoal.ts`; each screen that passes a message to `useFleetingMessage` hands over `onGone`.
- A small shared helper for "count saves on their way, reload after a failure", if the three hooks share enough of it (name to settle in the plan).
- Docs: the issue's own checklist; `docs/screens/README.md` only if a screen's described behavior changes (Settings says "A failed save puts back the earlier choice"; after this, the earlier choice comes back from the API).

**Out:**

- **`useDay` and `useWeek`** (decision 1): check-off, place, back to bank, swap and add go through the queue, where a failure doesn't roll back but waits and sends again (ADR-010). Their non-queued writes ("Still matter?", wrap-up) already show the message each time and read the week again.
- `useAdd`: it waits for the save and shows the message on each failure already.
- New wording.

## Commands

As spec 043a.

## Code style

As spec 042.

## Testing strategy

Hook tests, as the issue lists them:

- An edit that fails after a later save has succeeded shows the message and ends on the API's aspiration (the old name).
- Two saves under way, both failing more than 5 s apart: the message shows for each (fake timers).
- Two moves in the same instant: the page ends on the API's order.
- `useSettings`: two quick intensity taps, the first failing, end on what the API has, with the message.
- `useGoal`: a save failing while a second is on its way doesn't wipe the second from the screen.
- `useFleetingMessage`: `onGone` is called when the message fades and when it's tapped.

No browser check is needed beyond the agent's usual pass at phone width: with the mock saving instantly and the real API rarely failing, the hook tests are where this is proved. Optionally, the agent stops the API mid-save on the aspiration page and checks the message and the page after it comes back.

## Boundaries

- **Always:** the screen ends on the server's record after a failure.
- **Never:** put a queued change back on failure (that's the queue's job).

## Success criteria

- [ ] Every failed save on the aspiration page, Settings and a goal's page shows the message, and the page ends on what the API has.
- [ ] `latestSave` is gone from `useAspiration` and `useSettings`; `useGoal` reloads only once its saves are done.
- [ ] The same message failing twice shows twice.
- [ ] The issue's hook tests added.

## Settled with Jan, 2026-11-20

Both as recommended.

1. **Leave `useDay` and `useWeek` out?** Recommended: yes. Their frequent saves are queued now, so "a failed save rolls back" no longer applies to them, and their other writes already report every failure. The issue's own comment left this to be decided "whether the offline queue covers it", and it does.
2. **Close #17 with this,** including its "Done before #41" line, which is out of date? Recommended: yes. #41 shipped without it, and nothing since depends on it.
