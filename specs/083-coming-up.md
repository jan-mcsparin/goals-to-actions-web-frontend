# Spec: Coming up

Status: draft, 2026-11-26; decisions 1 to 7 agreed with Jan as recommended. Finalised when its plan is written. Issue: [#83](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/83). The last front-end piece of the scheduling brief, after [080](080-any-week.md), [082](082-move-and-remove.md) and [081](081-late-check-offs.md). Needs API [#52](https://github.com/jan-mcsparin/goals-to-actions-api/issues/52) ([`api/specs/coming-up.md`](../../api/specs/coming-up.md), built): `getComingUp` and the week read's `nextUp`. This PR regenerates the types for it.

## Objective

A Coming up page shows the next 12 weeks at a glance: how full each looks, and what's set, due or checked in. Today there's no way to see past the week on show, and no hint on Today of what's next.

References: [brief](../../docs/briefs/scheduling-and-other-weeks.md) ("Coming up", "Fullness"); design [`scheduling.png`](../../docs/screens/scheduling.png), panel "Coming up" and the note under "A past day"; [`flows.md`](../../docs/flows.md) flow 9 step 4; [`docs/screens/README.md`](../../docs/screens/README.md) (Coming up, Today's Coming up line); ADR-010 (Coming up is read online only, brief settled 3).

### What exists afterwards

1. **The page** (`{ screen: 'comingUp' }`): a back link, the title "Coming up", the subtitle "The next 12 weeks, starting next week", then one row per week from `getComingUp`.
2. **A week's row, line 1:** the range in bold ("Nov 30–Dec 6"); then, only when the week has any, a hollow ring and "1 check-in", "2 deadlines" or "1 check-in · 1 deadline" (the lengths of `checkIns` and `deadlines`); the week bar (080's `FullnessBar`, against 25); ▸ or ▾. The marker text alone trims with an ellipsis on a narrow phone; the range and bar never do.
3. **Line 2:** the counts line (080's `CountsLine`) from the week's `counts`.
4. **Open and closed:** the first two weeks start open, the rest closed. Tapping line 1 or 2 opens or closes the row (a button with `aria-expanded`). Not remembered between visits.
5. **An open week lists its dated things by day**, tasks, check-ins and deadlines merged by day (decision 5): the date once per day ("Wed 25"), then a mark (a filled dot in the "added" blue for a task, a hollow ring for a check-in or deadline), the title, a second line saying what it is, and a chevron. Then **See the week ›**, which opens Week on that week. A week with nothing reads "Nothing set to a day", then See the week ›.
   - **A task:** its title. Second line (decision 4): "Step · Plan the ski trip" for a one-off goal's step; else its time ("at 4:30 p.m.", "by 6 p.m."); else "Due" when it's listed by its due date (no `plannedDay` in that week); else none. A step with a time adds it: "Step · Plan the ski trip · at 4:30 p.m.".
   - **A check-in:** "Check in: Have endurance", then "Milestone 3 of 4 · opens the goal".
   - **A deadline:** "Deadline: Look good", then "Opens the goal".
   - **Where a tap goes:** a task opens its day; a check-in or deadline opens the goal's page.
6. **Getting there:** **Coming up ›** on every week's header on Week (080 left it out until now), right-aligned on the row with This week; and Today's last line.
7. **Today's last line:** "Coming up: Haircut · Wed at 4:30 p.m. ›", from the stored current week's `nextUp`, so it shows instantly and offline (API decision 1). Only on Today, not on other opened days. Left out when `nextUp` is empty, or when its day is today or before (a stored read from yesterday). Tapping it opens Coming up. Wording (decision 6): the task's title; then its day, "Wed" within the next 6 days, else "Wed, Dec 16"; then its time if it has one; "due" before the day when it's there by its due date ("Renew passport · due Tue").
8. **Back and the tabs** (decisions 1 to 3): Coming up opened from Week says "‹ Week" and goes back to the week it came from, under the Week tab; opened from Today it says "‹ Today", under the Today tab. A day or a goal opened from Coming up goes back to Coming up ("‹ Coming up").
9. **Online only** (brief, settled 3): read each time the page opens, never stored. While it loads, the header shows alone; on a failure, under the header: "Coming up needs a connection. It'll show once you're back online." (decision 7). Today's line needs nothing but the stored week.
10. **Mock:** `getComingUp` the server's way, closely enough for tests and `npm run dev:mock`: the 12 weeks with the same counts the mock's `getWeek` gives, its pinned and due hand-added tasks, check-ins and deadlines; `nextUp` on the current week's read.

## Scope

**In:**

- `src/api/openapi.ts` regenerated; `src/api/types.ts` names `ComingUp` and `ComingUpWeek`; a hand-written `ComingUpRead` (the weeks plus the ids of one-off goals, from `getComingUp` and `listGoals` together, as `realAspirations.ts` does).
- `src/api/client.ts`, `realPlan.ts`: `getComingUp()`. `mockStore.ts`/`mockWeek.ts`: Coming up and `nextUp`.
- `src/domain/comingUp.ts` (new): `markerLine(week)`, `comingUpDays(week, oneOffGoalIds)` (the merged, dated rows with their second lines and where a tap goes), `initiallyOpen(index)`, `nextUpLine(nextUp, today)` (or `undefined`).
- `src/hooks/useComingUp.ts` (new): the read (online only), which rows are open, the failure line.
- `src/screens/ComingUp.tsx`, `ComingUp.css` (new); `src/screens/Week.tsx` (Coming up ›); `src/screens/Day.tsx` and `useDay.ts` (Today's line, and the day's back label when opened from Coming up).
- `src/storage/navigation.ts`: `{ screen: 'comingUp'; from: ComingUpOrigin }`, `day` gains an optional `from`, `GoalOrigin` gains Coming up; `tabOf`; `App.tsx`.
- Tests: `domain/comingUp.test.ts`, `hooks/useComingUp.test.tsx`, `screens/ComingUp.test.tsx`, `screens/Week.test.tsx` (the link), `screens/Day.test.tsx` (Today's line; back to Coming up), `storage/navigation.test.ts`, `api/realPlan.test.ts`, `api/client.test.ts` (mock).
- Docs: `docs/screens/README.md` (Coming up and Today's line built; the inventory's "not built"), `docs/flows.md` flow 9 (Coming up built), the brief's status line, ADR-010 if Coming up's online-only read is worth a line, `specs/README.md`.

**Out:**

- Anything on the API.
- Recurring work in the list (it shows on each day of the week).
- Reminders before a set thing (brief, open question 1).
- Opening, moving or ticking anything from Coming up itself: a tap only opens the day or the goal.
- Swipe, sticky week headers, or remembering which rows were open.

## Decisions

Agreed with Jan, 2026-11-26, as recommended.

1. **Coming up is its own screen,** `{ screen: 'comingUp', from }`, remembered like any other across an iOS restart. Recommended over a sheet: the design shows a page with a back link, it holds 12 weeks, and a day or goal opened from it needs somewhere to come back to.
2. **Back goes where you came from.** From Week: "‹ Week", back to the week on show, Week tab lit. From Today: "‹ Today", Today tab lit. The design only shows "‹ Week"; the alternative, always "‹ Week", sends someone who tapped Today's line somewhere they weren't.
3. **A day or goal opened from Coming up comes back to Coming up** ("‹ Coming up"), so the person can look at several things in turn. The alternative, the day's own week ("‹ Week of Dec 7", as from Week), is less code but loses their place. Coming up is read again on the way back (online only), and the rows start open as on any visit (the first two), so a row opened further down is closed again. That's accepted: the open rows aren't remembered for the trip back.
4. **A task's second line:** step first, then time, then "Due", as the design shows ("Step · Plan the ski trip", "at 4:30 p.m.", "Due"). A task under a building goal, added by hand, gets no goal name here (it has one on its day). Knowing which goals are one-off needs `listGoals` alongside `getComingUp`, as the API spec says.
5. **Tasks, check-ins and deadlines are merged by day,** in that order within a day, so each date shows once, as the design does.
6. **Today's line:** "Wed" within the next 6 days, else "Wed, Dec 16", so a day two weeks out isn't mistaken for this coming Wednesday; "due Tue" for a task there by its due date, so a deadline doesn't read as a plan. The brief's example ("Haircut · Wed at 4:30 p.m.") is unchanged.
7. **Offline wording:** "Coming up needs a connection. It'll show once you're back online.", the same shape as 080's line for other weeks.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 24 from .nvmrc; Node 22 skips the jsdom tests
npm run api:types
npm test
npm run lint
npm run build
```

## Code style

As 080 and 081: wording and order in `domain/`, the read and open rows in `useComingUp`, the screen only renders.

```ts
// "1 check-in · 2 deadlines", or nothing when the week has neither.
export function markerLine({ checkIns, deadlines }: ComingUpWeek): string | undefined {
  const parts = [
    checkIns.length && plural(checkIns.length, 'check-in'),
    deadlines.length && plural(deadlines.length, 'deadline'),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

// "Coming up: Haircut · Wed at 4:30 p.m.", or nothing once its day has come.
export function nextUpLine(nextUp: Task | null, today: string): string | undefined { ... }
```

## Testing

- `domain/comingUp.test.ts`: the marker line (none, one of each, plurals); a week's days merged and ordered, each second line (step, step with time, time, due, none, check-in, deadline) and where it goes; "Nothing set to a day"; the first two open; `nextUpLine` for a set task with a time, a due one, one 6 and 7 days out, and none once its day is today or past.
- `useComingUp.test.tsx`: reads once on open and never stores; toggling a row; a failed read gives the offline line.
- `ComingUp.test.tsx`: 12 rows with range, markers, bar and counts; the first two open; a toggle; a task opens its day, a check-in and a deadline the goal; See the week › opens Week on that week; back from Week and from Today; the offline line.
- `Week.test.tsx`: Coming up › on this week, a past and a later week, opening Coming up.
- `Day.test.tsx`: Today's last line, its absence with no `nextUp` and with a stale one, not on other days, opening Coming up; a day opened from Coming up says "‹ Coming up" and goes back there.
- `navigation.test.ts`: the new screens round-trip; a bad `from` falls back.
- `realPlan.test.ts`: `getComingUp` asks `/coming-up` and `/goals`.
- Then a Sonnet agent checks at 390 px against the local API (the dev server and API are already running; it never stops them): Coming up from Week and from Today's line, back each way; the first two weeks open, the markers, bars and counts; open a closed row; a set task with a time, a due task, a step, a check-in and a deadline (made for the check and named "Verification: …"); a task opens its day and back returns; a check-in opens the goal; See the week ›; the long marker line trims at 390 px and nothing scrolls sideways; offline, the page says so and Today's line still shows.

## Boundaries

- **Always:** `nvm use` first; tests, lint and build before saying it's done; types regenerated, never hand-written; docs in the same PR.
- **Ask first:** storing Coming up on the phone; wording beyond the brief's and the decisions'; anything a tap does besides opening the day or the goal.
- **Never:** work out counts or what's dated on the phone (ADR-008); warn, colour red or refuse because a week looks full; a prompt or badge about what's coming.

## Success criteria

- [ ] Coming up shows the 12 weeks the API sends, each with range, markers, bar and counts; the first two open with their dated things.
- [ ] Every listed thing reads as the brief says and opens its day or goal; back returns as decided.
- [ ] Today's line shows `nextUp` instantly and offline, and is left out when there's none or its day has come.
- [ ] Coming up is never stored; offline it says so.
- [ ] Mock, tests and docs; tests, lint and build pass.

## Open questions

None.
