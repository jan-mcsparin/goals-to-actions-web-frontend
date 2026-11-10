# Spec: Goal detail screen (#5)

Status: draft 2026-11-10, awaiting approval. Issue: [#5](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/5). Module `goal-detail` in the [map](README.md). Depends on #4.

## Objective

Goal detail shows one goal in full: what it is, where it started, the milestones along the way, the weekly target and the next check-in. It's also the only place a goal is reviewed, paused or ended, and only when the person chooses to. Nothing on this screen opens on its own.

Everything works against the mock: actions change data and the Goals and Week screens reflect it.

References: [Flow 2](../../docs/flows.md#flow-2-set-a-goal-and-its-milestones), [Flow 6](../../docs/flows.md#flow-6-see-progress-and-check-in-at-milestones), [Flow 7](../../docs/flows.md#flow-7-rollovers-and-light-reviews), [tone rules](../../docs/product-rules.md#tone-and-prompts), [`other-screens.png`](../../docs/screens/other-screens.png).

### What the person sees

- **Header (pinned):** "‹ Goals" on the left, the type on the right ("Building", "Quitting", "One-off"). Then the label, the measurable line, and the aspiration's name if there is one. A paused goal reads "Paused" beside the type.
- **Where you started:** "Started at: Bench 145, squat 275, deadlift 315". Once any milestone has a result, a second line: "Latest: Bench 150, squat 290, deadlift 330 · Nov 2". Baselines and results are free text, so the two lines sit side by side; nothing is calculated. No baseline: the section is left out.
- **Milestones** ("Steps" for a one-off goal): a vertical timeline, in order, from Start to Goal. Each milestone shows:
  - its measurable line;
  - when: "Wk 8 · Nov 30" (weeks counted from the goal's start date), or "No date";
  - its status: "Hit" with the result, "Not yet", or nothing for upcoming. The next upcoming one is marked "Next".
  - "+ Add milestone" ("+ Add step") at the end: a measurable line and an optional date.
- **Weekly target** (building goals): "3 lifting sessions" and **Edit**. With none: "No weekly target yet" and **Set**. One-off goals show "Deadline: Dec 4" here instead, when they have one. Quitting goals show "Since Oct 5".
- **Next check-in:** the next upcoming milestone: its line and "week 8", or "whenever you choose" when it has no date, with a **Check in** button. None upcoming: "No check-ins coming up."
- **Actions:** Review · Pause · End goal. Pause reads Resume on a paused goal.

**A goal that isn't there** (a remembered id after the mock data reset): go back to Goals, quietly.

### Editing the weekly target

A sheet with an amount (whole number, at least 1) and a unit ("lifting sessions"). Saving adds a `WeeklyTarget` row effective from this week's Monday, or updates that row if it was already changed this week, so history is kept. The Week screen's "1 of 3" follows at once.

### Checking in

**Check in** opens a sheet titled with the milestone's line: "How did it go?" with one optional text field for the result, and two buttons, **Hit it** and **Not yet**.

- **Hit it:** the milestone is marked hit with today's date and the result. The screen shows one line, "Milestone hit: Bench 155, squat 300, deadlift 345", and Next check-in moves to the following milestone.
- **Not yet:** the milestone is marked not yet with the result. A card appears under Next check-in:
  - it leads with progress: "You started at bench 145, squat 275, deadlift 315. Now: bench 150, squat 295, deadlift 340." (baseline, then the result just entered; either part is left out if empty);
  - then three choices: **Keep the date**, **Move the date** (pick a new one), **Adjust the milestone** (edit its line and date);
  - each returns the milestone to upcoming. Until one is picked the card stays, and never appears anywhere but this screen.

For a one-off goal's step the buttons read **Done** and **Not yet**, and the rest is the same.

A milestone whose date has passed doesn't change by itself in the click-through; "not yet" comes from a check-in or the mock data.

### Pause, End, Review

- **Pause:** the goal becomes paused, at once, no confirmation. Its tasks already on a day stay there. It drops out of Week's progress rows and reads "Paused" on Goals. **Resume** makes it active again.
- **End goal:** a sheet that leads with what was achieved: "Started at … Latest …" and "2 of 3 milestones hit". Then **I reached it**, **End it for now** and **Cancel**.
  - Reached: status `reached`. The page then reads "Reached Nov 10" and, when it has an aspiration, "What's next for Be fit?" as plain text.
  - Ended: status `ended`. The page reads "Not yet." followed by the same achievement lines, with one action, **Go again**, which makes it active.
  - A reached or ended goal shows no Review, Pause or Check in.
- **Review:** a sheet with the goal's label, "Still important?" and, for a building goal, "Is 3 lifting sessions a week still right?". Four choices: **Keep as is**, **Adjust the target** (opens the target sheet), **Pause**, **End goal** (opens the End sheet). Each records today as the last review. Nothing ever asks the person to review.

## Scope

**In:**
- `api/`: `getGoal` and the mutations below; a `notYet` milestone in the mock data.
- `domain/goalDetail.ts`: timeline rows, week labels, next check-in, started/latest lines, achievement summary.
- `hooks/useGoal.ts`: load, optimistic updates, rollback with a message on failure (as `useDay` does).
- `screens/GoalDetail.tsx` (replacing #4's placeholder) and the sheets: target, check-in, add milestone, end, review.
- Docs: screens README (vertical timeline, check-in, the not-yet card, what Pause and End do); flows.md where a detail is settled here (a one-off goal's steps are milestones; "not yet" choices return the milestone to upcoming).

**Out (later):**
- Offering to keep a reached goal's practice as a recurring item; a "What's next" button (needs #6).
- Editing the label, measurable line, baseline, aspiration or deadline; deleting or reordering milestones.
- Quitting goals' daily log and urge rating.
- "This one slipped" for a passed deadline; any prompt that isn't opened by the person.
- Generating tasks from a target, and reflowing the week when a goal is paused or ended.
- Amount targets (miles, hours): count targets only, as on Week.

## API changes

```ts
getGoal(goalId: string): Promise<GoalDetail>
// { goal, aspiration?, milestones, weeklyTarget? }: milestones in order, the target in force this week.

setWeeklyTarget(goalId: string, amount: number, unit: string): Promise<WeeklyTarget>
addMilestone(goalId: string, milestone: { measurableLine: string; targetDate?: string }): Promise<Milestone>
checkInMilestone(milestoneId: string, outcome: 'hit' | 'notYet', result?: string): Promise<Milestone>
reopenMilestone(milestoneId: string, changes?: { measurableLine?: string; targetDate?: string }): Promise<Milestone>
// Back to upcoming: Keep the date (no changes), Move the date, Adjust the milestone.

pauseGoal(goalId: string): Promise<Goal>
resumeGoal(goalId: string): Promise<Goal>   // from paused or ended; clears endedAt
endGoal(goalId: string, outcome: 'reached' | 'ended'): Promise<Goal>   // sets endedAt
reviewGoal(goalId: string): Promise<Goal>   // sets lastReviewedAt
```

All keep #1's rules: async, return copies, reject unknown IDs and wrong states (checking in a milestone that's already hit, pausing an ended goal, an amount below 1, an empty line). No changes to the entity types.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/goalDetail.ts
export function weekLabel(startDate: string, targetDate: string | undefined): string {
  if (!targetDate) return 'No date'
  return `Wk ${weeksBetween(startDate, targetDate)} · ${shortDate(targetDate)}`
}
```

## Testing strategy

- **`domain/goalDetail.test.ts`:** timeline rows and statuses; "Next" on the first upcoming; week labels, including no date; next check-in with and without a date and with none left; started and latest lines with missing parts; achievement summary; "Steps" wording for one-off.
- **`api/client.test.ts`:** `getGoal` contents and unknown id; each mutation's effect and its rejections; a target changed twice in a week leaves one row for that week and keeps the old one; `getWeek` reflects a new target and leaves out a paused goal.
- **`hooks/useGoal.test.tsx`:** optimistic update and rollback for one mutation; unknown goal reports not found.
- **`screens/GoalDetail.test.tsx`:** renders the mock goal; edit the target; check in as hit (next milestone shown); check in as not yet (card leads with the baseline, then each of the three choices clears it); add a milestone; Pause then Resume; End as reached and as ended; Go again; Review records the date; a one-off goal reads Steps and Done; no dialog is open on first render.
- **`App.test.tsx`:** a remembered goal that doesn't exist lands on Goals.
- **Manual:** 375 and 390 px, light and dark; a six-step timeline; long measurable lines; sheets clear the keyboard and the home indicator.

## Boundaries

- **Always:** every sheet opens only from a tap; "not yet" copy leads with progress since the baseline; keep target history (never overwrite an earlier week's row); run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency (including a date picker; use `<input type="date">`); changes to entity types.
- **Never:** words like "missed", "failed", "behind" or "overdue"; a prompt, badge or reminder to review or check in; moving or removing tasks when a goal is paused or ended.

## Success criteria

- [ ] Every acceptance criterion on #5 is met.
- [ ] The weekly target can be set and changed, and Week follows.
- [ ] A check-in records hit or not yet; the not-yet card leads with progress and offers keep, move, adjust.
- [ ] Pause, Resume, End (reached or ended), Go again and Review each change the goal as described, and Goals reflects it.
- [ ] Milestones can be added; one-off goals read "Steps".
- [ ] Nothing opens unprompted; a missing goal returns to Goals.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Open questions

1. **Timeline direction: not settled.** The sketch draws it left to right with two milestones. Measurable lines and six steps don't fit that way at phone width. This spec stacks it top to bottom; the alternative keeps the sketch's row and scrolls it sideways, with the line and result shown for the milestone that's tapped. Jan wants to see both before choosing, so the plan's first task for this section is a rough version of each on the phone. Everything else in the spec holds either way.
2. **Progress since baseline is two lines of text** ("Started at", "Latest"), not a number, because baselines and results are free text. Enough for now?
3. **A new target takes effect this week**, so "1 of 3" can become "1 of 4" on Wednesday. The alternative is from next Monday.
4. **End goal asks "reached or not"** rather than working it out, since nothing can tell whether "bench 175" was crossed.
5. This is the largest of the five. The plan will likely split it into two PRs: the read-only screen with the target edit, then check-in and the actions.
