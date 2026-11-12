# Implementation Plan: Settings screen (#7)

Spec: [`../specs/007-settings-screen.md`](../specs/007-settings-screen.md). Tasks: [`todo.md`](todo.md). (The plan for #6 and #19 is in git history at `2e8b3b8`; #5's at `b0e33b6`; #13's at `255c054`; #4's at `f87a231`.)

## Overview

A gear in the Aspirations header opens Settings. It counts as Aspirations in the tab bar, "‹ Aspirations" goes back, and it's remembered like the other screens. Settings has the one dial, intensity (Easing off / Normal / Going hard), which saves when tapped. It also shows Week starts (Monday) and Notifications (Off), and has an Export my data row that answers "Coming later." Nothing reads the intensity yet.

One PR, `settings-screen` (closes #7), plus a parent-repo docs PR linked from it.

## Settled with Jan, 2026-11-12

1. **Intensity resets on reload** in the click-through, like every other mock change. No `localStorage` stand-in; the API will keep it.

## Dependency graph

```
spec settled ──► domain/settings.ts, getSettings, setIntensity ──┐
                                                                  ├──► useSettings + intensity radio group + Export message
navigation 'settings' ──► gear on Aspirations ──► Settings screen ┘
(header, back, Week starts, Notifications)
                                                                        └──► docs (parent PR) + spec marked built
```

Tasks 2 and 3 don't touch the same files and can be built in either order. Task 4 needs both.

## Architecture decisions

- **`settings` is a screen in `storage/navigation.ts`**, with no params. `tabOf` already sends everything that isn't Today, Week or a day to Aspirations, so the tab bar needs no change. Only `parseScreen` learns the new value.
- **Back always goes to the Aspirations tab.** The gear is only on the tab, so there's no `from` to keep.
- **`useSettings()` loads through `useLoaded`** like the other screens, so it has the same message slot and the same reload on the data revision. Intensity changes use the same optimistic save as `useAspiration`: show the change, save it, and if it fails put back what was there with "Couldn't save that. Try again." Only the newest save may roll back, so quick taps (or arrow keys) end on the last choice.
- **The intensity control is three native radio inputs** in a `role="radiogroup"` labelled "Intensity", styled like `ViewToggle` (three columns). Native radios give arrow-key movement and focus for free, with no new dependency and no hand-rolled key handling. Each change saves.
- **Week starts and Notifications are plain rows, not controls.** They show from the start, without waiting for the load: they're constants in the click-through. Intensity shows once loaded.
- **Export uses the screen's message:** tapping it puts "Coming later." in the `ScreenMessage` slot, where it fades after 5 s like any other message. The hook does this, so the component only renders.
- **`setIntensity` sets `intensitySetOn` to today** (`toLocalDay(new Date())`, as `endGoal` does). Setting the same intensity again still saves and still moves the date, since that's what the person did. No type or field changes (spec boundary).
- **Load failure:** "Couldn't load settings. Try again in a moment." It stays until tapped, as on the other screens. The header and the two constant rows still show.

## Phases

1. **Spec, API and navigation.** Spec settled; the API functions; the gear, the screen with its header and constant rows, and remembering it.
2. **Intensity and Export.** `useSettings`, the radio group, Export's message. → Checkpoint 1 (phone).
3. **Docs.** Parent docs PR, spec marked built. → Checkpoint 2, PR closes #7.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The three labels don't fit in one row at 375 px ("Going hard", "Easing off") | Med | Equal columns with `min-width: 0` and a slightly smaller font if needed. Checked on the phone at Checkpoint 1. If they still don't fit, ask before wrapping or stacking. |
| Arrow keys on radios fire a save per step, and an older failure rolls back a newer choice | Med | Only the newest save rolls back (the `latestSave` counter, as in `useAspiration`). A test makes two quick changes, with the first failing. |
| A stored `settings` screen from an older build, or junk in storage, breaks restore | Low | `navigation.test.ts`: `settings` round-trips; unknown values still fall back to Today. |
| Wording ranks the choices or hints at a change | Low | Copy is only what the spec lists. Read through at Checkpoint 1 against the spec's "Never". |
