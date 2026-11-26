# Implementation Plan: Any week on Week, with how full it is (#80)

Spec: [`../specs/080-any-week.md`](../specs/080-any-week.md). Issue: [#80](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/80). Tasks: [`todo.md`](todo.md). (Plans for earlier specs are in git history.)

## Overview

Week gets ‹ › arrows from the first week with rows to 12 weeks ahead, a title ("This week", "Last week", "Next week", "Week of Dec 7"), a counts line and week bar on every week, and day bars on opened weeks. A week that hasn't opened shows the note and only what's known. The This week | Next week toggle goes. Only the current week and an open next week are stored; other weeks are read online.

## Architecture decisions

- **Types first.** `npm run api:types` from `../api/openapi.json`, which is API #51's (`any-week` branch, PR #57, open). `api/types.ts` names `WeekCounts`, `DayCounts`, `Occurrence`, `CheckInDate`, `GoalDeadline`. The mock fills every new field so the build compiles from the first commit.
- **The week shown is in the open screen:** `{ screen: 'week'; week?: string }`. No `week` means this week (the Week tab). `Week` gets `week` and `onShowWeek(monday)`; App passes `goTo`. A day's back goes to `{ screen: 'week', week: mondayOf(date) }`, labelled by the week's title. `storage/weekView.ts` is removed.
- **Which read:** `useWeek(today, shown)` always reads the current week (and an open next week) the stored way, as now: it gives `firstWeek`, `nextWeekOpen` and the wrap-up. When the week shown is neither of those, it also reads that week fresh, with nothing stored and nothing from storage. Its failure shows "Other weeks need a connection. They'll show once you're back online." under the header.
- **Only open weeks are stored.** `useStoredWeeks`'s `store()` writes only weeks with `status === 'open'`, and `useDay`'s stored read ignores a stored week that isn't open (copies saved before this change). That one rule covers Week and a day of another week alike.
- **Limits:** back to `mondayOf(firstWeek)` (this week when `null`), forward to this week + 12. "This week" here is the current week's `week` from the read (it can be the one after the phone's week, after an early wrap-up). A remembered week outside the limits shows this week.
- **Wording and bars in `domain/week.ts`:** `weekTitle`, `countsLine`, `barSegments` (each segment's share of the bar, full past `against`), `weekLimits`, `knownDaySummaries` (a not-open week's day lines), and `daySummaries` counting a row with a `weekOutcome` on its day (it reads as not done). Accessible labels: "About 16 things, against a typical week of 25"; a day "3 of 4 for a day".
- **Components:** `FullnessBar` (size `week` | `day`, plain spans, `role="img"` with the label) and `CountsLine`. Colours as CSS custom properties in `Week.css`.
- **A closed week:** Progress and Days as now; bank chips as plain text, not buttons. Wrap up only when the week shown is the week after the current one and next week is open.
- **A not-open week's day** (opened from Week): Pull from bank and Swap hidden (`canPlace` false when the week's `status` is `notOpen`). Everything else on that day is 082's.

## Task list

See [`todo.md`](todo.md) for the checklist. Each task leaves tests, lint and build passing and is its own commit.

1. **Types and the mock.** Regenerate; name the types; the mock's `getWeek` fills `status` (closed before the current week, open for it and an open next week, else notOpen), `firstWeek` (earliest week of any stored task), `counts` (actual from the tasks returned; expected from pinned tasks, fixed-day items and each building goal's target, decision 6), `days[].counts` (null when notOpen), `occurrences` (fixed-day items due that week, notOpen only), `checkIns` (dated upcoming milestones of active goals), `deadlines`, and `weekOutcome` (null; `lapsed` for the mock's lapsed tasks in a past week). Files: `openapi.ts`, `types.ts`, `client.ts`, `mockStore.ts` or a new `mockWeek.ts`, `client.test.ts`.
2. **The wording.** `weekTitle`, `countsLine`, `barSegments`, `weekLimits`, `knownDaySummaries`, `daySummaries` with `weekOutcome`. Files: `domain/week.ts`, `domain/week.test.ts`.
3. **Only open weeks stored.** `store()` filters; `useDay`'s stored read ignores a non-open week. Files: `useStoredWeeks.ts`, `useDay.ts`, `useStoredWeeks.test.tsx`.
4. **The week shown, in the open screen.** `Screen`'s `week`; `readScreen` validates it; App wires `week` and `onShowWeek`; a day's back goes to its week with the title as label; `weekView.ts` goes. Files: `navigation.ts`, `navigation.test.ts`, `App.tsx`, `Day.tsx`, `useDay.ts` (the back label), `weekView*.ts`.
5. **Arrows and any week.** `useWeek(today, shown)`: the stored current/next read, the fresh read of another week, limits, `step`, `toThisWeek`, the offline line; the header with ‹ title › range and This week; the toggle removed; Wrap up on an open next week. Files: `useWeek.ts`, `Week.tsx`, `Week.css`, `Week.test.tsx`.
6. **Counts line and bars.** `CountsLine`, `FullnessBar`; the header row; a day bar on each day of an opened week. Files: `components/CountsLine.tsx`, `components/FullnessBar.tsx` (+ css), `Week.tsx`, `Week.test.tsx`.
7. **A week that hasn't opened, and a past week.** The note, the known day lines and "Nothing set yet", no Progress/Bank/day bars; a closed week's bank as text; no Pull or Swap on a not-open week's day. Files: `Week.tsx`, `useWeek.ts`, `Week.test.tsx`, `useDay.ts`, `Day.test.tsx`.
8. **Docs.** `docs/screens/README.md`, `docs/flows.md` flow 9, `docs/product-rules.md` rules 11 and 12, ADR-010 (a note), the brief's status line, `specs/README.md`, the spec's status, `CLAUDE.md` (the stored weeks line).
9. **The check.** A sonnet agent at 390 px against the local API and dev server (already running), as the spec's Testing says; its findings fixed or reported; a "Checked" note in the spec.

Checkpoints: after 3 (the foundations: full suite, lint, build), after 7 (the screen end to end on `npm run dev:mock`), after 9.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| API PR #57 isn't merged; the types come from the local `any-week` branch | Med | The front-end PR says so and merges after #57. |
| This branch stacks on the specs PR #91 | Low | Merge #91 first, or retarget this PR to `main` before deleting #91's branch. |
| Week stored before this change lacks `status`, so "open only" would hide this week offline | High | Treat a stored week with no `status` as open when it's the current or next week (`storedCurrentAndNext` reads only those); `useDay` ignores only a stored week whose `status` is set and isn't open. Tested. |
| The counts line wraps at 390 px | Low | `nowrap`, smaller dots; checked at 390 px with the longest real line. |
| The mock's expected counts drift from the API's | Low | They're rough by decision; the real rules are tested in the API. |

## Open questions

None.
