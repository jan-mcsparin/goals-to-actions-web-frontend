# Spec: Other screens offline (#43, part c)

Status: built 2026-11-20; plan in [`../tasks/plan.md`](../tasks/plan.md). Part c of [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43): a [real by default](043a-real-by-default.md) → b [stored week and queue](043b-stored-week-and-queue.md) → **c other screens offline** → d [sign-in around the queue](043d-sign-in-around-the-queue.md). Depends on part a and on part b's storage. [ADR-010](../../docs/adr/0010-week-document-and-replayed-queue.md): "The last response of every other read, so any screen opens instantly and can be read offline."

## Objective

Every screen opens at once from what it last showed, and can be read offline: Aspirations, an aspiration, a goal, Keep life running and Settings. A failed load never empties a screen that has something to show.

### What exists afterwards

1. **Each read keeps its last response** on the phone, keyed by the read and its id (`aspirations`, `aspiration/<id>`, `goal/<id>`, `upkeep`, `settings`). A screen shows the stored response first, then the fresh one when it lands.
2. **A failed load keeps what's shown.** With something stored or already on screen, the screen stays and the "Couldn't load" line says so; dismissing it leaves the screen as it was. This fixes #40's blank Aspirations tab.
3. **Offline, the screens read as they were.** Writes on them need a connection (ADR-010) and fail with "Couldn't save that. Try again." as now.
4. **Counts don't include unsent changes** (ADR-010): the Aspirations bars and a goal's progress catch up once the queue has sent and the screen reads again.

### Accepted until later

- A screen never opened on this phone shows the ordinary load failure offline.
- A change on one screen reaches another screen's stored response only when that screen reads again: after renaming an aspiration, the Aspirations tab opens with the old name and shows the new one once its read lands (offline, it keeps the old one).
- Stored responses are cleared on sign-out (part d).

## Scope

**In:**

- `src/storage/`: a store for last responses, beside part b's (same database).
- `src/hooks/useLoaded.ts`: takes a key; shows the stored response first, stores each fresh one, keeps data on a failure. The hooks that use it pass their key.
- The dismiss path that empties the screen (traced in the plan; likely the message slot taking the screen's place).
- Docs: `CLAUDE.md` (storage).

**Out:**

- The week (part b). Sign-in (part d). Making writes on these screens queueable (ADR-010 says they need a connection).

## Commands

As part a.

## Project structure

Unchanged, plus a `responses` store in `src/storage/planStore.ts` (or its own small module beside it).

## Code style

As spec 042. The hook grows one argument:

```ts
const { data: overview, message } = useLoaded('aspirations', getAspirations, LOAD_FAILED)
```

## Testing strategy

- **`useLoaded.test.tsx`:** stored data shows before the load lands; a fresh load replaces and stores it; a failure keeps what's shown and sets the message; no stored data and a failure shows the message alone; a stale stored response for another id isn't shown.
- **Screens:** the Aspirations tab stays after a failed load and a dismissed message.
- **Manual, by a Sonnet agent at phone width:** open each screen online, go offline, reload, and each opens from what it showed; a load failure online with data on screen leaves it there after the message is dismissed.

## Boundaries

- **Always:** a storage failure leaves the screen working as it does now; screens still call `api/` only.
- **Ask first:** any dependency.
- **Never:** show one id's stored response on another id's screen; store anything from the sign-in routes.

## Success criteria

- [x] Each screen opens from its last response, then refreshes.
- [x] Each can be read offline once opened online.
- [x] A failed load never empties a screen that has something to show.
- [x] Tests and docs updated.

## Settled with Jan, 2026-11-20

1. **A stored response is kept until a fresh one replaces it or sign-out clears it.** Nothing expires.

## Built differently, or noted while building

- **The empty tab was nothing to show, not the dismiss.** `useLoaded` already kept data on a failed load, and with data the message isn't sticky. The tab went empty when a first load failed with nothing loaded; a stored response gives it something to show. A screen never opened on this phone still shows the failure alone (accepted above).
- **A record that's gone forgets its stored response:** a 404 deletes it, and it isn't shown.
- **What a screen shows is what's stored**, its saves included (found in review: storing only reads left a renamed aspiration opening with its old name). It's kept under the key it came from, so while another id loads, the old one's data is never stored under the new id.
- **Found in the browser check:** offline, the load fails before the store answers, and the first version then dropped the stored response. Only a fresh response (or a 404) now outranks it; a regression test covers it.
- The database is version 2 (adds `responses`); the upgrade creates whichever store is missing.

## Checked, 2026-11-20

By a Sonnet agent with Chrome DevTools at 390×844, against the local API:

- **Online:** Aspirations, Be fit's page, a goal, Keep life running and Settings each loaded and stored their response (`aspirations`, `aspiration/<id>`, `goal/<id>`, `upkeep`, `settings`); the database was at version 2.
- **Offline** (gone offline after loading; the dev server has no service worker, so an offline reload isn't possible there): each screen showed what it last showed, with its "Couldn't load …" message; tapping the message left the screen as it was, the Aspirations tab included.
- **A write offline:** intensity showed "Couldn't save that. Try again." and stayed on Normal.
- **Back online:** fresh reads, no console errors from the app.
- Not checked: an offline reload of the installed app (with #8's phone checks), and upgrading a real version-1 database.
