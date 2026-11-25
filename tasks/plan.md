# Implementation Plan: Report every failed save (#17)

Spec: [`../specs/017-every-failed-save.md`](../specs/017-every-failed-save.md). Issue: [#17](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/17) (closes it, settled 2). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

Every save that fails, and isn't queued, shows "Couldn't save that. Try again." each time. Once no saves are left on their way, the screen reads its record again from the API instead of putting back a guess.

## Architecture decisions

- **`useFleetingMessage(message, { sticky, onGone })`**: `onGone` is called when the message fades or is tapped. Each screen hook exposes `clearMessage()`, and each screen passes it as `onGone`. That's every screen that shows a message (Day, Week, Upkeep, Aspirations, Aspiration, Goal detail, Settings), so the same text set again shows again. App's own confirmation is a different message and stays as it is.
- **`useLoaded` gains `reload()`**. It runs the screen's load again through the same path, so the stored response and "only the newest load lands" still apply. A failed load no longer replaces a message that's already showing. A failed reload after a failed save keeps "Couldn't save that", as `useGoal` does today. When nothing is showing, the load message shows as before.
- **Shared helper `hooks/useSavesOnTheirWay.ts`**: `track(save)` clears the message, counts the save, and shows SAVE_FAILED if it fails. Once the count reaches 0 and a failure happened, it calls `reload()` once. If a save starts while that reload is still on its way, one more reload runs when the saves are done, so the reload can't wipe a change from the screen.
- **`useAspiration`** (edit, move) and **`useSettings`** (intensity): `latestSave` and the rollback go. They now use the helper. **`useGoal`**: its optimistic saves use the helper and reload only when none are left. The `lastSave` guard stays, so a slow save doesn't flash over a newer one. `saveThenReload`, `retire` and `bringBack` stay as they are.
- `useSettings.exportData` sets the message directly. The clear-then-set workaround goes.

## Tasks

1. **`onGone` in `useFleetingMessage`.** Tests: called when the message fades and when it's tapped. (XS)
2. **Every screen hands over `onGone`.** Each hook gains `clearMessage`. Screens pass it, and the `exportData` workaround goes. Tests: Settings export shows twice, and the same save failure shown twice on a screen. (S)
3. **`reload()` in `useLoaded`.** Tests: a reload brings the fresh record; a failed reload keeps the data and the save message. (S)
4. **`useSavesOnTheirWay` and `useAspiration`.** Tests: an edit that fails after a later save succeeded ends on the API's name, with the message. Two moves at the same instant end on the API's order. Two saves failing more than 5 s apart show the message for each (fake timers, with `useFleetingMessage`). (M)
5. **`useSettings` intensity.** Test: two quick taps, the first failing, end on the API's intensity, with the message. (S)
6. **`useGoal`.** Test: a save that fails while a second is on its way doesn't wipe the second from the screen. (S)
7. **Docs and check.** Update `docs/screens/README.md` Settings ("comes back from the API"), the spec (built), the specs README, and the issue checklist. A Sonnet agent checks phone width. (S)
