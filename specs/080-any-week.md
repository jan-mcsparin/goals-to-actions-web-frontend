# Spec: Any week on Week, with how full it is

Status: draft, 2026-11-25; decisions 1 to 6 agreed with Jan the same day, settled when the plan is written. Issue: [#80](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/80). The second front-end piece of the scheduling brief, written with [082](082-move-and-remove.md). Needs API [#51](https://github.com/jan-mcsparin/goals-to-actions-api/issues/51) ([`api/specs/any-week.md`](../../api/specs/any-week.md), built). This PR regenerates the types for it.

## Objective

Week steps to any week with ‹ › arrows, and every week shows how full it is. Today Week shows this week and, from Sunday 6 p.m., next week behind a toggle; nothing shows a past week or one further out, and nothing says how full a week is.

References: [brief](../../docs/briefs/scheduling-and-other-weeks.md) ("Any week", "Fullness", settled 1 to 3); design [`scheduling.png`](../../docs/screens/scheduling.png), panels "This week" and "A future week"; [`product-rules.md`](../../docs/product-rules.md) rules 11 and 12; ADR-010.

### What exists afterwards

1. **The header:** ‹, the title, ›, and the range under the title. The title is "This week", "Last week", "Next week", else "Week of Dec 7". The This week | Next week toggle goes.
   - **‹** stops at the week of `firstWeek` (from the current week's read); with no rows at all, at this week. **›** stops 12 weeks after this week, matching Coming up. A stopped arrow is disabled, not hidden, so the title doesn't shift.
   - Under it, the **counts line** and the **week bar** on one row, then **This week** (a link, only when not on it). **Coming up ›** waits for #83 (decision 4).
2. **The counts line:** "● 8 for 3 goals · ● 5 upkeep · ● 2 added", from the read's `counts`. Each dot is its segment's colour; numbers and words in dark text. It never wraps (`white-space: nowrap`; at 390 px the longest real line fits beside the bar). "1 for 1 goal" in the singular; with no goal sessions, "0 for goals" (decision 5).
3. **The week bar:** 64 × 10 px, three segments in order (goal sessions `#1E4E8C`, upkeep `#4F86C6`, added `#A9C5E8`) on a track outlined `#9DB4D3`, against 25. Past 25 it's full, nothing else. Read aloud as "About 16 things, against a typical week of 25".
4. **This week, an open next week, and past weeks:** Progress, Days and Bank as now. Each day row gets a **day bar** (40 × 8 px, the same segments, from `days[].counts`, against `days[].cap`), after "done" or "Full". Read aloud as "3 of 4 for a day".
   - **A past week** (`closed`) lists every row the read returns, rolled over and lapsed included, so its days read as they were. Its bank chips show but aren't buttons: there's no day left to put them on. Ticking off late is #81.
   - **Next week** keeps **Wrap up this week** at the bottom, as now, whenever the week shown is the one after the current week and it's open.
5. **A week that hasn't opened** (`notOpen`): the note "Only what's set to a day shows here. Recurring work is placed when this week opens, on the Sunday evening before.", then Days. Each day lists, joined with " · ": its tasks (with their time, as now), its fixed-day items (`occurrences`), "Check in: Lift" for each check-in and "Deadline: Lift" for each deadline. An empty day reads "Nothing set yet". No Progress, no Bank, no day bars, no "Full".
6. **Tapping a day opens it, as now,** and the day's "‹" goes back to that day's week, named by its title: "‹ This week", "‹ Last week", "‹ Week of Dec 7". On a day of a week that hasn't opened, Pull from bank and Swap are hidden (there's no bank). What else that day shows is 082's.
7. **The week shown is remembered** as part of the open screen (`{ screen: 'week', week }`), so it survives the day round-trip and an iOS restart. The Week tab opens this week. A remembered week out of range (before `firstWeek`, or more than 12 ahead now that time has moved on) opens this week (decision 2).
8. **Other weeks are read online only** (settled 3). The current week and an open next week are stored and open instantly, as now. Every other week, and a day in one, is read when shown and never stored; on a failure the header still shows, with "Other weeks need a connection. They'll show once you're back online." (decision 3). ADR-010 gets a note.
9. **Mock:** `getWeek` fills `status`, `firstWeek`, `counts`, `days[].counts`, `occurrences`, `checkIns`, `deadlines` and `weekOutcome`, the server's way, closely enough for tests and `npm run dev:mock`: actual counts from the tasks it returns, expected ones from its pinned tasks and fixed-day items (decision 6).

## Scope

**In:**

- `src/api/openapi.ts` regenerated; `src/api/types.ts` names `WeekCounts`, `DayCounts`, `Occurrence`, `CheckInDate`, `GoalDeadline`.
- `src/domain/week.ts`: `weekTitle(week, current)`, `countsLine(counts)` (its three parts, for the line and the label), `barSegments(counts, against)`, the not-open day line (`knownDaySummaries`), `daySummaries` counting a row with a `weekOutcome` on its day, and `weekLimits(current, firstWeek)` for the arrows.
- `src/hooks/useWeek.ts`: takes the Monday to show; reads the stored weeks for the current and open next week, and other weeks fresh only; `canGoBack`, `canGoForward`, `step(±1)`, `toThisWeek`; `status`; the wrap-up as now.
- `src/hooks/useStoredWeeks.ts` or `WeeksRead`: a read that doesn't store (other weeks), and stored copies of other weeks ignored.
- `src/screens/Week.tsx`, `Week.css`; a `FullnessBar` component (week and day sizes) and `CountsLine`.
- `src/screens/Day.tsx`, `src/hooks/useDay.ts`: the back label; Pull and Swap hidden on a not-open week; its week read online only when it isn't stored.
- `src/storage/navigation.ts` (`week` on the Week screen), `App.tsx`; `src/storage/weekView.ts` and `ViewToggle` on Week removed (the toggle stays for Today's List | By goal).
- `src/api/mockData.ts`, `mockStore.ts`, `client.ts`: the new fields.
- Tests: `domain/week.test.ts`, `screens/Week.test.tsx`, `screens/Day.test.tsx`, `storage/navigation.test.ts`, `hooks/useStoredWeeks.test.tsx`, `api/mockData.test.ts`.
- Docs: `docs/screens/README.md` (Week: drop "not built" for other weeks; the toggle goes), `docs/flows.md` (flow 9), `docs/product-rules.md` rules 11 and 12 (built on Week), ADR-010 (a note: other weeks online only), the brief's status line, `specs/README.md`.

**Out:**

- Ticking off a past day, its note and wording (#81). Until then a past day opens as now.
- What an opened day of a not-open week lists besides its tasks, and Move and Remove (082).
- Coming up and its links (#83).
- Swipe between weeks.

## Decisions

Agreed with Jan, 2026-11-25.

1. **The arrows are buttons in the header row,** labelled "Previous week" and "Next week" for screen readers, at least 44 px square. The title is a heading; the range under it as now.
2. **The week shown lives in the open screen,** not in its own storage key. It's the one place the app already remembers where the person was, and it lets "‹" from a day go back to the right week. `weekView.ts` goes; a stored `'next'` from before reads as this week once.
3. **Offline wording for other weeks:** "Other weeks need a connection. They'll show once you're back online." It's shown for any failed read of another week, since the phone can't tell "offline" from "server down" reliably and either way waiting is the answer. The current week keeps its own message.
4. **Coming up › is left out until #83** builds the page it opens, rather than a link to nothing.
5. **No goal sessions reads "0 for goals"**, and the three parts always show, so the line keeps its shape from week to week.
6. **The mock's expected counts are rough:** pinned tasks as added, fixed-day items as upkeep, and each building goal's target as sessions. The real rules are the API's (ADR-008); the mock only needs believable numbers.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm run api:types
npm test
npm run lint
npm run build
```

## Code style

As spec 042: wording in `domain/`, reads and stepping in `useWeek`, the screen only renders.

```ts
// "● 8 for 3 goals · ● 5 upkeep · ● 2 added", as three parts the line colours one by one.
export function countsLine({ goalSessions, goals, upkeep, added }: WeekCounts): CountPart[] {
  const goalPart = goalSessions === 0 ? '0 for goals' : `${goalSessions} for ${goals} ${goals === 1 ? 'goal' : 'goals'}`
  return [
    { origin: 'goalSessions', text: goalPart },
    { origin: 'upkeep', text: `${upkeep} upkeep` },
    { origin: 'added', text: `${added} added` },
  ]
}

// Each segment's share of the bar; full past `against`, never more.
export function barSegments(counts: DayCounts, against: number): Segment[] { ... }
```

## Testing

- `domain/week.test.ts`: each title (this, last, next, "Week of Dec 7" across a month); the counts line, singular and zero; segments under, at and over 25 and the cap; a not-open day's line in order, and "Nothing set yet"; a closed week's day with a rolled-over and a lapsed row; the arrow limits with and without `firstWeek`, and at +12.
- `Week.test.tsx`: stepping back and forward changes title, range and counts; the arrows stop at both ends; a not-open week shows the note and known items and no Progress, Bank or day bars; This week returns; Wrap up shows on an open next week only; a failed read of another week shows the offline line under the header; the bars' accessible names.
- `Day.test.tsx`: "‹ Week of Dec 7" goes back to that week; no Pull or Swap on a not-open week's day.
- `navigation.test.ts`: `{ screen: 'week', week }` round-trips; a bad week falls back to this week.
- `useStoredWeeks.test.tsx`: a read of another week isn't stored.
- Then a sonnet agent checks Week at 390 px against the real API: stepping to the first week and 12 ahead, a past week, a not-open week with the dentist task from 079, the bars, no horizontal scroll, and the offline line using the browser's offline mode (the dev server and API are already running; the agent never stops them).

## Boundaries

- **Always:** `nvm use` first; tests, lint and build before saying it's done; docs in the same PR; types regenerated, never hand-written.
- **Ask first:** a new dependency (none expected: the bars are plain elements); storing other weeks on the phone.
- **Never:** work out counts, occurrences or a not-open week's plan on the phone (ADR-008); warn, colour red or refuse anything because a week or day looks full.

## Success criteria

- Week reaches every week from `firstWeek` to 12 ahead, each with the counts and bar the API sent; a not-open week shows only what's known.
- This week and an open next week open instantly from storage, as now; other weeks are never stored.
- The bars and "Full" agree on every day.
- Tests, lint and build pass.

## Open questions

None.
