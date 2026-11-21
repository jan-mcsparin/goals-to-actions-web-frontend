# Spec: Sign-in around the queue (#43, part d)

Status: draft 2026-11-20. Part d of [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43): a [real by default](043a-real-by-default.md) → b [stored week and queue](043b-stored-week-and-queue.md) → c [other screens offline](043c-other-screens-offline.md) → **d sign-in around the queue**. Depends on parts b and c. Designed in [ADR-012](../../docs/adr/0012-sign-in-with-a-passkey.md) and the sign-in sketch, panels 4 and 5 (`../docs/screens/sign-in.png`, notes in `docs/screens/README.md#sign-in`). These are the parts of sign-in that #48 left here, each at a marked spot in `src/hooks/useSession.ts`.

## Objective

A session that ends never costs the person what they did, and never takes the screen away. Signing out on purpose sends what's waiting first, then leaves nothing of theirs on the phone.

### What exists afterwards

1. **Session ended (panel 4).** A 401 while using the app keeps the screen on what the phone has stored, with a sheet: "Sign in to keep saving. Everything you did is safe on this phone: 3 changes will send as soon as you're back in." (With nothing waiting, the second sentence is left out.) **Sign in** goes to the passkey; **Not now** closes it.
2. **The banner.** After Not now, a small banner sits on the screen: "Not signed in · 3 changes waiting · Sign in". Tapping Sign in opens the passkey. Changes made meanwhile join the queue and show at once, as offline.
3. **After signing in,** the queue sends (part b), then the open screen reads again.
4. **Signing out (panel 5).** The Settings sheet ("Sign out of this device?") sends the queue first. If changes can't be sent, it warns: "3 changes haven't been sent yet. Signing out deletes them from this phone." and the button reads **Sign out anyway**. Then everything stored is cleared: the week documents, the other screens' last responses and the queue (ADR-012). Then the sign-in page.
5. **First sign-in on a phone, or after sign-out,** stays the full sign-in page, as now: there's nothing stored to show.

### Accepted until later

- Phone checks after hosting (#8, #48).

## Scope

**In:**

- `src/hooks/useSession.ts`: signed-out vs session-ended (signed in before, with something stored); Not now; the marked spots.
- `src/App.tsx`: the app stays mounted on a session end; the sign-in page only when there's nothing stored.
- `src/components/SessionEndedSheet.tsx`, `SignedOutBanner.tsx`; the sign-out sheet's warning.
- `src/storage/`: clear everything (part b's and c's stores).
- Docs: `docs/screens/README.md#sign-in` (built), ADR-012 if anything differs.

**Out:**

- Signing in on another device, account switching (one person).
- Anything on the API.

## Commands

As part a.

## Project structure

Two components as above; no new modules otherwise.

## Code style

As spec 042; sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`).

## Testing strategy

- **`useSession.test.tsx`:** a 401 with stored data is "session ended", not "signed out"; Not now shows the banner; signing in sends the queue then reloads; sign-out sends first, warns when it can't, clears every store, then shows the sign-in page.
- **Screens:** the sheet and banner copy with 0, 1 and 3 changes waiting.
- **Manual, by a Sonnet agent at phone width against the local API:** end the session on the server (delete it in the local database, or a short session length), make a change: the sheet shows over Today with the count; Not now leaves the banner; sign in with the soft passkey and the change sends. Sign out with the API stopped: the warning and **Sign out anyway**; after it, IndexedDB is empty.

## Boundaries

- **Always:** the queue is never dropped on a 401 or 403; sign-out clears only after the person has seen the warning.
- **Ask first:** clearing anything beyond ADR-012's list (decision 1).
- **Never:** show the session-ended sheet as an error; put a name or account on screen (the API has none).

## Success criteria

- [ ] A 401 keeps the stored screen and shows the sheet with the count; Not now leaves the banner.
- [ ] After signing in, the queue sends and the screen reads again.
- [ ] Sign-out sends first, warns when it can't, then clears every store.
- [ ] Tests and docs updated.

## Settled with Jan, 2026-11-20

1. **Sign-out clears ADR-012's list only:** the week documents, the screens' last responses and the queue. The open screen, List / By goal and each goal's Show all stay.
2. **The wording is as written** in items 1, 2 and 4.
