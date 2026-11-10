# Spec: Settings screen (#7)

Status: draft 2026-11-10, awaiting approval. Issue: [#7](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/7). Module `settings-screen` in the [map](README.md). Depends on #4.

## Objective

Settings holds the one dial the app has, intensity, and shows the few other preferences. It's opened rarely, and only when the person chooses: the app never asks about pace.

References: [Flow 8](../../docs/flows.md#flow-8-set-intensity), [product rules: planning](../../docs/product-rules.md#planning), [`other-screens.png`](../../docs/screens/other-screens.png).

### What the person sees

**Getting there:** a gear button in the Goals header, top right, labelled "Settings" for screen readers. Settings counts as Goals in the tab bar, and "‹ Goals" goes back. The open screen is remembered like the others.

**The screen**

- **Header (pinned):** "‹ Goals" and "Settings".
- **Intensity:** three choices in a row: Easing off, Normal, Going hard. One is always selected; Normal to start. Under it: "Sets how full days are and how much is free."
  - Tapping one saves it at once. There's no Save button and no confirmation.
  - It stays until changed. Nothing resets it, and nothing suggests changing it.
- **Week starts:** Monday. Shown, not editable.
- **Notifications:** Off. Shown, not editable. The app asks for no permission.
- **Export my data:** a row that, when tapped, shows "Coming later."

In the click-through nothing reads the intensity yet; the planner will, from its next draft.

## Scope

**In:**
- `api/`: `getSettings`, `setIntensity`.
- `domain/settings.ts`: the three intensities in order with their labels.
- `hooks/useSettings.ts`: load, optimistic change, rollback with a message on failure.
- `screens/Settings.tsx`; the gear in `screens/Goals.tsx`; `settings` in `storage/navigation.ts`, `useNavigation` and `App.tsx`.
- Docs: screens README (Settings is reached by the gear on Goals; what each row does).

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

The intensity control is a radio group (`role="radiogroup"`, arrow keys move the choice), styled like the List / By goal toggle.

## Testing strategy

- **`api/client.test.ts`:** `getSettings` returns the mock settings; `setIntensity` changes the value and the date and is seen by the next `getSettings`; returns copies.
- **`storage/navigation.test.ts`:** `settings` round-trips.
- **`screens/Settings.test.tsx`:** Normal is selected at first; tapping Going hard selects it and calls `setIntensity`; a failed save goes back to the earlier choice with a message; Week starts reads Monday and Notifications reads Off, neither a control; Export shows "Coming later."
- **`App.test.tsx`:** the gear opens Settings; Goals stays current in the tab bar; "‹ Goals" returns; Settings survives a remount.
- **Manual:** 375 and 390 px, light and dark; the three labels fit on one row at 375 px.

## Boundaries

- **Always:** the person sets intensity, and it stays; run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency; new fields on `Settings`; requesting notification permission.
- **Never:** a prompt, hint or badge suggesting a different intensity; wording that ranks the choices (Easing off is not a lesser setting).

## Success criteria

- [ ] Every acceptance criterion on #7 is met.
- [ ] The gear on Goals opens Settings; back returns to Goals; the screen is remembered.
- [ ] Intensity shows the saved choice, changes with one tap, and stays changed after leaving and returning.
- [ ] Week starts, Notifications and Export read as described.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Open questions

1. **The gear lives on Goals only.** You asked for a gear but not where. Goals keeps Today's header clear; the alternative is a gear on every screen's header.
2. **Intensity resets on reload** in the click-through, like every other mock change. If you'd like it to stick before the API exists, it could be kept in `localStorage`.
