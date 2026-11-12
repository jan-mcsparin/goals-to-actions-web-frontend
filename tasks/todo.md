# Tasks: Settings screen (#7)

Plan: [`plan.md`](plan.md). Spec: [`../specs/007-settings-screen.md`](../specs/007-settings-screen.md).

Every task: `nvm use` (Node 24), write tests first, then `npm test && npm run lint && npm run build`, then one commit. Test dates are fixed to Wednesday 11 Nov 2026. New test files call `resetStore()` in `beforeEach`.

# PR: `settings-screen` (closes #7)

### Task 1: Settle spec 007

**Description:** Close the open question (intensity resets on reload, plan decision 1). Add the architecture decisions that the spec doesn't already cover: native radios in the radiogroup, Export using the screen message, the load-failure wording, and that the constant rows show before the load. Mark it approved.

**Acceptance criteria:**
- [x] No open questions left; each decision is in the section it changes.
- [x] Status reads approved, dated 2026-11-12.

**Verification:**
- [x] Read through against `plan.md`; `npm test && npm run lint && npm run build` still pass

**Dependencies:** None

**Files:** `specs/007-settings-screen.md`

**Scope:** XS

### Task 2: `INTENSITIES`, `getSettings` and `setIntensity`

**Description:** `domain/settings.ts` exports `INTENSITIES` (the three in order, with labels) as in the spec. `getSettings()` returns a copy of the store's settings. `setIntensity(intensity)` sets the intensity and `intensitySetOn` to today, and returns a copy.

**Acceptance criteria:**
- [ ] `getSettings` returns Normal, set on 2026-10-01, weeks starting Monday; changing the returned object doesn't change the store.
- [ ] `setIntensity('goingHard')` returns Going hard set today, and the next `getSettings` agrees; an unknown value rejects.
- [ ] `INTENSITIES` lists Easing off, Normal, Going hard, in that order.

**Verification:**
- [ ] `npm test`: `client.test.ts` (a settings block), new `domain/settings.test.ts`

**Dependencies:** Task 1

**Files:** `src/domain/settings.ts`, `src/domain/settings.test.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Scope:** S

### Task 3: The gear opens Settings

**Description:** `settings` joins the `Screen` union and `parseScreen`. The Aspirations header gets a gear button labelled "Settings" at the top right. `screens/Settings.tsx` shows the pinned header ("‹ Aspirations", "Settings") and the two constant rows: Week starts: Monday, and Notifications: Off. `App` renders it, with back going to the tab.

**Acceptance criteria:**
- [ ] The gear opens Settings; Aspirations stays current in the tab bar; "‹ Aspirations" returns.
- [ ] Settings is still open after a remount; `settings` round-trips in storage, and junk still falls back to Today.
- [ ] Week starts reads Monday and Notifications reads Off, and neither is a button or input.

**Verification:**
- [ ] `npm test`: `navigation.test.ts`, `Aspirations.test.tsx`, new `screens/Settings.test.tsx`, `App.test.tsx`

**Dependencies:** Task 1

**Files:** `src/storage/navigation.ts`, `src/storage/navigation.test.ts`, `src/screens/Aspirations.tsx`, `src/screens/Aspirations.css`, `src/screens/Settings.tsx`, `src/screens/Settings.css`, `src/App.tsx`, tests

**Scope:** M

### Task 4: Intensity and Export

**Description:** `hooks/useSettings.ts` loads settings through `useLoaded` and gives the screen `intensity`, `setIntensity` (optimistic, rolled back with "Couldn't save that. Try again." on failure, newest save wins), `exportData` (sets "Coming later.") and the message. Settings shows the intensity radiogroup once loaded, with "Sets how full days are and how much is free." under it, and an Export my data row. The screen's message shows through `ScreenMessage`; a load failure is sticky.

**Acceptance criteria:**
- [ ] Normal is selected at first; tapping Going hard selects it and calls `setIntensity`; leaving and coming back shows Going hard.
- [ ] A failed save goes back to the earlier choice with the message; with two quick changes where the first fails, the second stays. Arrow keys move the choice.
- [ ] Export my data shows "Coming later."; a failed load shows "Couldn't load settings. Try again in a moment." until tapped, with the header and constant rows still there.

**Verification:**
- [ ] `npm test`: new `hooks/useSettings.test.tsx`, `Settings.test.tsx`, `App.test.tsx`

**Dependencies:** Tasks 2, 3

**Files:** `src/hooks/useSettings.ts`, `src/hooks/useSettings.test.tsx`, `src/screens/Settings.tsx`, `src/screens/Settings.css`, `src/screens/Settings.test.tsx`

**Scope:** M

## Checkpoint 1
- [ ] Tests, lint and build pass
- [ ] On the phone, 375 and 390 px, light and dark: the gear is easy to tap and doesn't crowd the title; the three intensity labels fit on one row at 375 px; the selected choice is clear in both themes; "Coming later." sits above the tab bar
- [ ] Copy read against the spec's Never: nothing ranks the choices or hints at a change

### Task 5: Docs

**Description:** Parent repo (own branch and PR): the screens README's Settings line says what each row does (intensity saves on tap and stays; week start and notifications are shown, not set; export is coming later), and Flow 8 notes that the click-through keeps intensity until reload. Front end: spec 007 marked built, and `specs/README.md` moves 007 to Done.

**Acceptance criteria:**
- [ ] `docs/` describes Settings as built, with no row that does more than it does.
- [ ] `specs/README.md` lists 007 under Done; only #8 remains.

**Verification:**
- [ ] `npm test && npm run lint && npm run build`; read-through of the parent diff

**Dependencies:** Checkpoint 1

**Files:** `../docs/screens/README.md`, `../docs/flows.md`, `specs/007-settings-screen.md`, `specs/README.md`

**Scope:** S

## Checkpoint 2
- [ ] Tests, lint and build pass
- [ ] Every success criterion in spec 007 and every acceptance criterion on #7 met
- [ ] PR opened, closing #7, with the parent-repo docs PR linked
