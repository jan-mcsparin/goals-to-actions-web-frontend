# Spec: Sign-in around the queue (#43, part d)

Status: built 2026-11-20; plan in [`../tasks/plan.md`](../tasks/plan.md). Part d of [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43): a [real by default](043a-real-by-default.md) → b [stored week and queue](043b-stored-week-and-queue.md) → c [other screens offline](043c-other-screens-offline.md) → **d sign-in around the queue**. Depends on parts b and c. Designed in [ADR-012](../../docs/adr/0012-sign-in-with-a-passkey.md) and the sign-in sketch, panels 4 and 5 (`../docs/screens/sign-in.png`, notes in `docs/screens/README.md#sign-in`). These are the parts of sign-in that #48 left here, each at a marked spot in `src/hooks/useSession.ts`.

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

- [x] A 401 keeps the stored screen and shows the sheet with the count; Not now leaves the banner.
- [x] After signing in, the queue sends and the screen reads again.
- [x] Sign-out sends first, warns when it can't, then clears every store.
- [x] Tests and docs updated.

## Settled with Jan, 2026-11-20

1. **Sign-out clears ADR-012's list only:** the week documents, the screens' last responses and the queue. The open screen, List / By goal and each goal's Show all stay.
2. **The wording is as written** in items 1, 2 and 4.

## Built differently, or noted while building

1. **"Something stored"** is any week document, any screen's last response or any queued change (`api/stored.ts`). A phone that can't read its store counts as having nothing, so it gets the sign-in page.
2. **Once ended, it stays so until a sign-in:** later 401s (each new change tries to send) keep the banner, and the sheet doesn't reopen after Not now. A 401 whose answer lands after a sign-in is ignored.
3. **The banner's Sign in opens the sheet with the passkey,** so a sign-in that doesn't finish has somewhere to say so.
4. **With nothing waiting,** the sheet reads "Everything you did is safe on this phone." and the banner "Not signed in".
5. **The sign-out warning shows after a send fails,** not on opening the sheet: the first Sign out sends; only if changes are still waiting does the note show and the button turn to **Sign out anyway**. Cancel forgets it, so the next try sends again. A 401 while sending doesn't open the session-ended sheet: the warning says it instead.
6. **The banner sits above the screen,** in the content's width, rather than under the header as sketched: the header is each screen's own.
7. **After review:** sign-out shows the sign-in page first and clears a moment later, once the screens have closed, so a read still landing can't store what it read. Whether anything is stored is counted (`Shelf.count()`), not read, and only on the first 401. The sheet's, banner's and warning's wording is in `domain/session.ts`.
8. **Shared pieces:** the Face ID icon and the passkey buttons' styles moved to `components/` (`FaceIdIcon.tsx`, `signInButtons.css`) for the sheet and the sign-in page.


## Checked, 2026-11-20

By a Sonnet agent with Chrome DevTools at 390×844, against the local API, with the soft passkey:

- **Session ended:** with the server's sessions ended, checking off a task on Today opened "Sign in to keep saving" with "1 change will send as soon as you're back in."; Today stayed behind it, the task shown checked.
- **Not now:** the banner "Not signed in · 1 change waiting"; a second check-off raised it to 2 and the sheet didn't come back.
- **Signing in from the banner:** the banner went, both changes sent (the week read from the API had them done) and stayed after a reload. Unchecked afterwards.
- **Sign-out offline:** the first Sign out showed "1 change hasn't been sent yet. Signing out deletes them from this phone." and **Sign out anyway**; Cancel forgot it, and the next try sent first and warned again. After Sign out anyway, the sign-in page, and `gta-plan`'s `weeks`, `queue` and `responses` were empty; `gta.screen` and `gta.todayView` stayed.
- **Back online after that:** the app opened signed in, since the sign-out request never reached the server and the session there was still alive (as accepted in #48: "the session ends on its own in time").
- No console errors from the app.
- Noted: the banner scrolls away with the page, and while it shows, Today's own "changes waiting to send" line shows too.
- **Rechecked after review:** with only a week stored and no change made, a 401 showed the sheet with "Everything you did is safe on this phone." (the IndexedDB count); the banner's live region is its text alone; a change made while signed out was sent after signing in from the banner; signing out online showed the sign-in page at once, and `weeks`, `queue` and `responses` were empty then and 3.5 s later. No console errors from the app.
