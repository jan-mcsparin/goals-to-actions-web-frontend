# Implementation Plan: Sign-in around the queue (#43, part d)

Spec: [`../specs/043d-sign-in-around-the-queue.md`](../specs/043d-sign-in-around-the-queue.md). Issue: [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43) (part d of four; closes it). Tasks: [`todo.md`](todo.md). Design: ADR-010, ADR-012, sign-in sketch panels 4 and 5. (Plans for 043a–c are in git history.)

## Overview

A 401 keeps the app on what the phone has stored, with a sheet asking to sign in; Not now leaves a banner. Signing out on purpose sends the queue first, warns when it can't, then clears ADR-012's list.

## Architecture decisions

- **Three session states** in `useSession`: `signedIn`, `sessionEnded` (a 401 with anything stored: a week, a last response or a queued change), `signedOut` (a 401 with nothing stored: first sign-in, or after sign-out). App stays mounted for `sessionEnded`; the sign-in page only for `signedOut`.
- **Not now** is session state: later 401s (each new change tries to send) keep the banner and don't reopen the sheet.
- **The banner's Sign in** opens the passkey directly. If it doesn't finish, the sheet opens again with the calm line, so the message has somewhere to show.
- **After signing in**, App awaits `flush()` and then reloads the open screen.
- **Sign-out**: tapping Sign out sends the queue. If changes are still waiting, the sheet shows the warning with the count and the button reads **Sign out anyway**; nothing is cleared until that second tap. Closing the sheet forgets the warning. A 401 while signing out doesn't open the session-ended sheet.
- **Clearing** (`storage/clearStored.ts` or in `queue.ts`): `planStore().clear()` plus a new `discardQueue()` that empties the queue held in memory. A failed clear still signs out. Open screen, view toggle and Show all stay (settled 1).
- Sheet and banner copy as the spec: "Sign in to keep saving" title; "Everything you did is safe on this phone: 3 changes will send as soon as you're back in." (sentence left out at 0; "1 change"). Banner "Not signed in · 3 changes waiting · Sign in" ("· N changes waiting" left out at 0). Banner sits under the screen's header, as sketched.

## Tasks

1. **Clearing what's stored.** `discardQueue()` in `api/queue.ts`; one `clearStored()` that empties every shelf and the queue. Tests. (XS)
2. **Session ended vs signed out.** `useSession`: the three states, Not now, banner sign-in reopening the sheet on failure; App flushes then reloads after sign-in. Tests in `useSession.test.tsx`. (M)
3. **Sign-out sends first.** `useSession.signOut`: flush, warn with the count, sign out anyway, clear, signed out; 401s ignored meanwhile. `SignOutSheet` warning and button. Tests (hook and Settings). (M)
4. **Sheet, banner and App.** `SessionEndedSheet.tsx`, `SignedOutBanner.tsx`; App keeps the screen on a session end. Copy tests with 0, 1 and 3 waiting. (M)
5. **Docs and the browser check.** `docs/screens/README.md#sign-in` (built), ADR-012 if anything differs, CLAUDE.md; a Sonnet agent runs the spec's manual check at phone width against the local API; spec Checked and built. (S)
