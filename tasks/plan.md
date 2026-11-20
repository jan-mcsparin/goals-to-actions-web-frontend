# Implementation Plan: Sign in with a passkey, and stay signed in (#48)

Issue: [#48](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/48); no spec of its own. The rules are in [ADR-012](../../docs/adr/0012-sign-in-with-a-passkey.md) and the API's [`sign-in` spec](../../api/specs/sign-in.md) and [plan](../../api/tasks/plan.md) (the contract). Tasks: [`todo.md`](todo.md). (The plan for #30, #46 and #35 is in git history.)

## Overview

The API answers 401 without a session (`__Host-session`, an `HttpOnly` cookie the page never sees). The front end learns it's signed out only from a 401: there's no "who am I" route, and none is needed. It starts as signed in, and the first 401 flips it.

Five routes, all `POST /api/sign-in/…`: `code` (a one-time code → options to make a passkey), `passkeys` (keep it, and sign in), `start` and `finish` (sign in with a passkey), `sign-out`. Passkeys go through the browser's own functions: `PublicKeyCredential.parseCreationOptionsFromJSON` / `parseRequestOptionsFromJSON`, `navigator.credentials.create` / `get`, and the credential's `toJSON()`. No new dependency.

**One PR**, `sign-in-session`. Tasks 1–3 are the logic and change nothing on screen. Tasks 4–5 build sketches 1–3 and 5 of [`docs/screens/sign-in.png`](../../docs/screens/sign-in.png). The PR says "Part of #48": the phone checks wait for hosting (ADR-011), and sketch 4 waits for #43.

**Settled with Jan (2026-11-20):**
- **Sketch 4 (session ended: a sheet over the stored screen, Not now, the "N changes waiting" banner) is built in #43,** with the stored week and the queue. Until then any signed-out state shows the sign-in page.
- **No "Signed in as"** in Settings: the API has no name for a user. Account is just Sign out.
- **No tester note** on the add-a-passkey step.
- **The new logo's app icons and favicon are their own small PR.** The sign-in page uses the mark and the wordmark from `docs/brand/`.

## Decisions

- **A 401 is `SignedOutError`** (in `errors.ts`, beside `NotFoundError`). `request.ts` throws it and tells `api/session.ts`, a tiny listener list. The sign-in routes' own 401s mean "that didn't work", so they don't tell the session.
- **A signed-out load shows no "Couldn't load".** `useLoaded` leaves the message alone for `SignedOutError`; the sign-in screen is the message. Saves keep their ordinary "Couldn't save that" until #43's queue keeps them.
- **`api/signIn.ts` returns an outcome, not an exception:** `signedIn`, `cancelled` (the person closed the passkey sheet), `didntWork` (the API's 401), `unsupported` (the browser lacks the JSON functions, ADR-012's open question), or a thrown plain `Error` for a failed request. The hook turns outcomes into copy.
- **The mock stays signed in.** In mock mode the sign-in functions answer `signedIn` without the browser, and sign out works, so the click-through can sign out and back in. Mock data never answers 401, so the test suite is unchanged.
- **`useSession` lives in App, given by context** like the data revision. It holds `signedIn`, the copy to show, and `signIn`, `addPasskey(code)`, `signOut`. After signing in it raises the data revision, so the open screen loads again.
- **Settings gets `onSignOut` from App,** as screens get their other callbacks.
- **The sign-in page has three steps,** state in `useSession`: sign in; enter a code (redeemed on Continue); add a passkey (made on Add passkey, with the redeemed options). Back from the code step returns to sign in.
- **The mark and wordmark are inline SVG components** copied from `docs/brand/` without the C2PA metadata. No web font: the wordmark falls back to the system font, as its README allows.
- **The sign-out sheet uses the app's `sheet.css` and `useModalDialog`,** like the other sheets. Its "N changes haven't been sent" warning comes with #43's queue.
- **Left for #43:** sending the queue after signing in and before signing out, and clearing what's stored on the phone at sign out. None of it exists yet; this PR leaves a marked spot in `useSession` for each.

## Task list

- [x] Task 1: A 401 is SignedOutError and tells the session
- [ ] Task 2: Passkey and code steps in `api/signIn.ts`
- [ ] Task 3: `useSession`

Checkpoint after task 3: build, lint and tests pass; nothing on screen has changed.

- [ ] Task 4: The sign-in page
- [ ] Task 5: Sign out in Settings, docs, and a check in the browser

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| iOS lacks `parseCreationOptionsFromJSON` / `toJSON()` | Med | The `unsupported` outcome says so plainly; a small helper is a later change, if the hosted check finds it's needed (ADR-012). |
| Several screens' loads all 401 at once | Low | The session's state is a boolean; repeat notices change nothing. |
| A real passkey can't be acted out in tests or by an agent's browser | Med | Unit tests stub `navigator.credentials`; Jan tries it once in Chrome on `localhost` with a code from the API's command. |

## Assumed, for review with this plan

1. No "who am I" route: the app opens as signed in and a 401 decides.
2. The click-through can sign out and back in on mock data.
3. Copy follows the sketch, except: the code error ends "Ask for a new one." (no name), and "this iPhone" reads "this device", since the Mac signs in too. The button keeps "Sign in with Face ID", as sketched.
4. Jan's uncommitted `docs/brand/`, `docs/screens/sign-in.png` and README section go in a docs PR in the parent repo, with the README's open items updated to what was settled.
