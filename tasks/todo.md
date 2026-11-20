# Tasks: Sign in with a passkey, and stay signed in (#48)

Plan: [`plan.md`](plan.md). Issue: #48.

Every task:
1. `nvm use` (Node 24).
2. Write the tests first.
3. Run `npm test && npm run lint && npm run build`.
4. Make one commit.

### Task 1: A 401 is SignedOutError and tells the session

**Description:** `SignedOutError` in `api/errors.ts`, exported from `client.ts` as `NotFoundError` is. `request.ts` throws it on a 401 and, unless the path is under `/sign-in`, calls `signedOut()` in a new `api/session.ts` (`onSignedOut(listener)` returns an unsubscribe). `useLoaded` sets no load-failed message for it.

**Acceptance criteria:**
- [x] A 401 rejects with `SignedOutError` and tells the session's listeners once.
- [x] A 401 from a `/sign-in/…` route rejects with `SignedOutError` and tells no one.
- [x] 403, 409, 422 and 500 stay plain errors.
- [x] A load that's signed out leaves no "Couldn't load" message.

**Files:** `src/api/errors.ts`, `src/api/session.ts` (+ test), `src/api/request.ts` (+ test), `src/api/client.ts`, `src/hooks/useLoaded.ts` (+ a test)

**Dependencies:** None · **Scope:** S

### Task 2: Passkey and code steps in `api/signIn.ts`

**Description:** `signInWithPasskey()`, `addPasskeyWithCode(code)`, `signOut()`, over the five routes. Each sign-in step returns `signedIn | cancelled | didntWork | unsupported`. A `NotAllowedError` from the passkey sheet is `cancelled`; the API's 401 is `didntWork`; no JSON functions is `unsupported`. In mock mode they answer `signedIn` (and sign out resolves) without touching the browser. Request and reply types come from `openapi.ts`.

**Acceptance criteria:**
- [x] Sign-in sends `startSignIn`'s options through `parseRequestOptionsFromJSON` and `credentials.get`, then `finishSignIn` with the challenge id and `credential.toJSON()`.
- [x] Adding a passkey does the same with `redeemCode`, `parseCreationOptionsFromJSON`, `credentials.create` and `addPasskey`.
- [x] Each outcome has a test; a failed request still throws.
- [x] The code is trimmed before it's sent; support is checked first, so a code isn't spent on a browser that can't use it.
- [x] The mock answers without the browser.

**Files:** `src/api/signIn.ts`, `src/api/signIn.test.ts`, `src/api/types.ts`, `CLAUDE.md` (structure)

**Dependencies:** Task 1 · **Scope:** M

### Task 3: `useSession`

**Description:** `hooks/useSession.ts`: `{ signedIn, step, busy, message, signIn, useCode, addPasskey, back, signOut }`, plus a `Session` context and `useSessionContext()`. Starts signed in; listens to `api/session.ts`. `step` is `signIn | code | addPasskey`. Copy, from the sketch: a cancelled or failed passkey is "Sign-in didn't finish. Try again when you're ready."; a code that didn't work is "That code didn't work. It may already have been used, or be more than ten minutes old. Ask for a new one."; `unsupported` is "This browser can't use a passkey."; a failed request is "Couldn't reach the app. Try again in a moment." After signing in it calls the given `onSignedIn` (App raises the data revision). Marked spots for #43: send the queue after sign-in; before sign out, send it and warn if it can't; clear storage.

**Acceptance criteria:**
- [ ] A 401 anywhere turns `signedIn` false.
- [ ] Each outcome sets the copy above, and signing in clears it.
- [ ] A redeemed code moves to `addPasskey` with its options kept; Back from `code` returns to `signIn`; an empty code isn't sent.
- [ ] Sign out ends signed out, even if the request fails (the cookie may be gone already).
- [ ] Hook tests over a stubbed `api/signIn.ts`.

**Files:** `src/hooks/useSession.ts`, `src/hooks/useSession.test.tsx`

**Dependencies:** Tasks 1, 2 · **Scope:** M

**Checkpoint:** build, lint and tests pass; nothing on screen has changed.

### Task 4: The sign-in page

**Description:** `screens/SignIn.tsx` (+ css), sketches 1–3 of `docs/screens/sign-in.png`, drawn from `useSessionContext()`. App shows it in place of the screens and tab bar while signed out. `components/LogoMark.tsx` and `Wordmark.tsx`: inline SVG from `docs/brand/`, without the metadata.
- **Sign in:** the wordmark, "Small steps today toward who you want to be.", the message line when there is one, **Sign in with Face ID**, **New device? Use a one-time code**, and "No password. Your passkey stays on your devices."
- **Code:** Back, the mark, "Enter your one-time code", "You get a code to set up a new device. It works once, within ten minutes.", one field (`autocomplete="one-time-code"`, labelled "One-time code"), the error under it, **Continue**.
- **Add a passkey:** "Code accepted", "Add a passkey to this device", "From now on you'll sign in with Face ID. There's nothing to remember, and nothing that can be phished. If iCloud Keychain is on, your Mac can use the same passkey.", **Add passkey**. No tester note.

**Acceptance criteria:**
- [ ] Each step and its message render; buttons are disabled while busy.
- [ ] The field is announced with its error (`aria-invalid`, `aria-describedby`).
- [ ] Buttons are `#2f6f4f`; the page reads well at iPhone width, light and dark.
- [ ] Component tests over a stubbed session.

**Dependencies:** Task 3 · **Scope:** M

### Task 5: Sign out in Settings, docs, and a check in the browser

**Description:** An Account section at the bottom of Settings with **Sign out**, which opens sketch 5's sheet: "Sign out of this device?", "This clears what's stored on this device. Your aspirations, goals and history stay safe on the server; sign in with your passkey to get them back.", **Sign out** and **Cancel**. (The unsent-changes warning and **Sign out anyway** come with #43.) Settings gets `onSignOut` from App.

Docs, in the parent repo on a docs branch: Jan's `docs/brand/`, `sign-in.png` and README section, with its open items settled (sketch 4 in #43, no name, no tester note, neutral code copy); `docs/flows.md` if it describes sign-in. Front-end `CLAUDE.md`: the new screen.

A Sonnet agent checks the click-through (mock sign out and back in) at iPhone width, light and dark. Jan tries a real passkey in Chrome on `localhost` with a code from the API's command.

**Acceptance criteria:**
- [ ] Sign out asks once, then shows the sign-in page; Cancel changes nothing.
- [ ] Signing in brings back the screen that was open.
- [ ] Docs say what was built.
- [ ] Build, lint and tests pass; PR opened as "Part of #48".

**Dependencies:** Task 4 · **Scope:** S
