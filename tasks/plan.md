# Implementation Plan: Other screens offline (#43, part c)

Spec: [`../specs/043c-other-screens-offline.md`](../specs/043c-other-screens-offline.md). Issue: [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43) (part c of four). Tasks: [`todo.md`](todo.md). Design: ADR-010. (The plans for 043a and 043b are in git history.)

## Overview

Every read other than the week keeps its last response on the phone. A screen shows that first, then the fresh read when it lands, so Aspirations, an aspiration, a goal, Keep life running and Settings open at once and read offline.

## Architecture decisions

- **A third shelf** in `storage/planStore.ts`: `responses`, keyed by the read (`aspirations`, `aspiration/<id>`, `goal/<id>`, `upkeep`, `settings`). Same database, version 2 (the upgrade adds the missing store). `clear()` empties it too, ready for part d.
- **`useLoaded(key, load, loadFailed)`**: reads the stored response for `key` and shows it unless the fresh load has already landed; stores each fresh load; on 404 deletes the stored one (so a gone record doesn't keep opening). Any storage failure is ignored and the screen works as now. Only reads are stored; a screen's own optimistic changes aren't, and the next read replaces them.
- **The empty tab traced:** `useLoaded` already keeps data on a failed load, and with data the message isn't sticky, so dismissing it leaves the screen. The tab went empty only because a failed first load had nothing to show and the message was all there was. With a stored response there is something to show. A screen never opened on this phone still shows the load failure alone (accepted in the spec).

## Tasks

1. **The responses shelf.** `planStore`: `responses`, version 2, cleared with the rest. Tests. (XS)
2. **useLoaded keeps the last response.** The key argument; stored first, fresh stored, a failure keeps it, 404 forgets it, no other id's response shown, storage failures ignored. The five hooks pass their key. Tests. (M)
3. **Screens.** Aspirations stays after a failed load and a dismissed message; a goal opens from its stored response. Tests. (S)
4. **Docs and the browser check.** CLAUDE.md (storage); a Sonnet agent checks each screen offline at phone width against the local API; spec Checked and built. (S)
