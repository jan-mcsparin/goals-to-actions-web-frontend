# Spec: Settings screen (#7)

Status: approved 2026-11-12. Issue: [#7](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/7). Module `settings-screen` in the [map](README.md). Depends on #4.

## Objective

Settings holds the one dial the app has, intensity, and shows the few other preferences. It's opened rarely, and only when the person chooses: the app never asks about pace.

References: [Flow 8](../../docs/flows.md#flow-8-set-intensity), [product rules: planning](../../docs/product-rules.md#planning), [`other-screens.png`](../../docs/screens/other-screens.png).

### What the person sees

**Getting there:** a gear button in the Aspirations header, top right, labelled "Settings" for screen readers. Settings counts as Aspirations in the tab bar, and "‹ Aspirations" always goes back to the tab (the gear is only there). The open screen is remembered like the others.

**The screen**

- **Header (pinned):** "‹ Aspirations" and "Settings".
- **Intensity:** three choices in a row: Easing off, Normal, Going hard. One is always selected; Normal to start. Under it: "Sets how full days are and how much is free."
  - Tapping one saves it at once. There's no Save button and no confirmation.
  - It stays until changed. Nothing resets it, and nothing suggests changing it.
  - A failed save puts back the earlier choice with "Couldn't save that. Try again."
- **Week starts:** Monday. Shown, not editable.
- **Notifications:** Off. Shown, not editable. The app asks for no permission.
- **Export my data:** a row that, when tapped, shows "Coming later." as the screen's message above the tab bar, which clears itself like any other.

Week starts and Notifications show at once; intensity shows once settings have loaded. If they can't load, "Couldn't load settings. Try again in a moment." stays until tapped, with the header and those two rows still there.

In the click-through nothing reads the intensity yet; the planner will, from its next draft. Like every other mock change, a new intensity lasts until the page reloads; the API will keep it.

## Scope

**In:**
- `api/`: `getSettings`, `setIntensity`.
- `domain/settings.ts`: the three intensities in order with their labels.
- `hooks/useSettings.ts`: load (through `useLoaded`), optimistic change, rollback with a message on failure, the newest change winning. Messages use the shared screen message from [#19](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/19), built in PR #23.
- `screens/Settings.tsx`; the gear in `screens/Aspirations.tsx`; `settings` in `storage/navigation.ts`, `useNavigation` and `App.tsx`.
- Docs: screens README (what each Settings row does; the gear is already there).

**Out (later):**
- Any effect of intensity on a plan (the planner); a task cap per day.
- Intensity that expires by itself (left open in Flow 8).
- Turning notifications on; a real export; changing the week's start day.
- Pausing everything while away (flows.md, edge cases).

## API changes

```ts
getSettings(): Promise<Settings>
setIntensity(intensity: Intensity): Promise<Settings>
// Sets intensitySetOn to today.
```

Same rules as #1: async, return copies. No type changes.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/settings.ts
export const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'easingOff', label: 'Easing off' },
  { value: 'normal', label: 'Normal' },
  { value: 'goingHard', label: 'Going hard' },
]
```

The intensity control is a radio group (`role="radiogroup"`, labelled "Intensity") of three native radio inputs, so arrow keys move the choice with no key handling of our own. Each move saves. It's styled like the List / By goal toggle, in three columns.

## Testing strategy

- **`api/client.test.ts`:** `getSettings` returns the mock settings; `setIntensity` changes the value and the date and is seen by the next `getSettings`; returns copies.
- **`storage/navigation.test.ts`:** `settings` round-trips.
- **`screens/Settings.test.tsx`:** Normal is selected at first; tapping Going hard selects it and calls `setIntensity`; a failed save goes back to the earlier choice with a message; Week starts reads Monday and Notifications reads Off, neither a control; Export shows "Coming later."
- **`App.test.tsx`:** the gear opens Settings; Aspirations stays current in the tab bar; "‹ Aspirations" returns; Settings survives a remount.
- **Manual:** 375 and 390 px, light and dark; the three labels fit on one row at 375 px.

## Boundaries

- **Always:** the person sets intensity, and it stays; run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency; new fields on `Settings`; requesting notification permission.
- **Never:** a prompt, hint or badge suggesting a different intensity; wording that ranks the choices (Easing off is not a lesser setting).

## Success criteria

- [ ] Every acceptance criterion on #7 is met.
- [ ] The gear on Aspirations opens Settings; back returns to Aspirations; the screen is remembered.
- [ ] Intensity shows the saved choice, changes with one tap, and stays changed after leaving and returning.
- [ ] Week starts, Notifications and Export read as described.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.
