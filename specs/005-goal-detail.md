# Spec: Goal detail screen (#5)

Status: built 2026-11-11 in two PRs (#20: the screen, condensed timeline, target and Add milestone; PR 2: check-in, not yet, pause and end), Review dropped; plan in [`../tasks/plan.md`](../tasks/plan.md). Issue: [#5](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/5). Module `goal-detail` in the [map](README.md). Depends on #4 and the [aspiration page](013-aspiration-page.md).

## Objective

Goal detail shows one goal in full: what it is, where it started, the milestones along the way, the weekly target and the next check-in. It's also the only place a goal is paused or ended, and only when the person chooses to. Nothing on this screen opens on its own.

Everything works against the mock: actions change data and the Aspirations tab, the aspiration page and Week reflect it.

References: [Flow 2](../../docs/flows.md#flow-2-set-a-goal-and-its-milestones), [Flow 6](../../docs/flows.md#flow-6-see-progress-and-check-in-at-milestones), [Flow 7](../../docs/flows.md#flow-7-rollovers-and-light-reviews), [tone rules](../../docs/product-rules.md#tone-and-prompts), [`other-screens.png`](../../docs/screens/other-screens.png).

### What the person sees

- **Header (pinned):** a back link on the left, the type on the right ("Building", "Quitting", "One-off"). Back returns wherever the person came from and is named for it: "‹ Aspirations" from the tab, "‹ Be fit" from the aspiration's page. (`goal-detail-timeline.png` still shows the older "‹ Goals".) Then the label, the measurable line, and the aspiration as a link up to its page: "Be fit ›". A goal with no aspiration has no link. A paused goal reads "Paused" beside the type.
- **Where you started:** "Started at: Bench 145, squat 275, deadlift 315". Once any milestone has a result, a second line with the most recent one: "Latest: Bench 150, squat 290, deadlift 330 · Nov 2". Baselines and results are free text, so the two lines sit side by side; nothing is calculated. No baseline: the section is left out.
- **Milestones** ("Steps" for a one-off goal): a vertical timeline, in order, from Start to Goal, with "1 of 6 hit" beside the heading. The Start row shows the start date and the baseline. The Goal row is the final milestone: it's the goal's own measurable line, with the deadline if there is one, and it counts in the total. It isn't a separate milestone record. Each milestone shows:
  - its measurable line;
  - when: "Wk 9 · Nov 30", or "No date". Weeks count from the goal's start, and the week it starts in is Wk 1 (Be strong starts Oct 5, so Nov 30 is Wk 9);
  - its status: "Hit" with the result, "Not yet", or nothing for upcoming.
  - **Next** marks the first milestone that isn't hit, whether upcoming or not yet. A check-in never skips past a milestone: one marked not yet stays Next until it's hit. When every milestone is hit, the Goal row is Next.
  - "+ Add milestone" ("+ Add step") at the end: a measurable line and an optional date, from the goal's start to its deadline.
- **Steps in any order:** a one-off goal's steps don't depend on each other, so every step that isn't done opens the check-in sheet when tapped. Next still marks the first one that isn't done.
- **Condensed timeline:** with more than four milestones, the timeline folds so the weekly target and Check in stay near the top of the screen. Design: [`goal-detail-timeline.png`](../../docs/screens/goal-detail-timeline.png) (option D, Nov 10).
  - Always shown: the latest hit milestone, any milestone marked "Not yet", Next, and the Goal row. For a building or quitting goal, a not-yet milestone is Next, so they're one row.
  - Each run of two or more other rows between them, Start included, folds into one tappable row on the rail: "Start and 1 hit milestone", "2 more: Wk 16, Wk 20". A run of one shows the row itself. Tapping a fold row expands the whole timeline.
  - Below the timeline, beside "+ Add milestone": **Show all 6** / **Show less**. Expanded or not is remembered per goal (in `storage/`, like the Today view toggle) and restored on open.
  - Four milestones or fewer: every row shows and there is no toggle.
- **Weekly target** (building goals): "3 lifting sessions" and **Edit**. With none: "No weekly target yet" and **Set**. One-off goals show "Deadline: Dec 4" here instead, when they have one. Quitting goals show "Since Oct 5".
- **Next check-in:** when Next is due: "Wk 10 · Dec 7", or "Whenever you choose" when it has no date, with a **Check in** button. No badge or different wording once the date has passed.
- **Actions:** Pause · End goal. Pause reads Resume on a paused goal.

**A goal that isn't there** (a remembered id after the mock data reset): go back to Aspirations, quietly.

### Editing the weekly target

A sheet with an amount (whole number, at least 1) and a unit ("lifting sessions"). Saving adds a `WeeklyTarget` row effective from this week's Monday, or updates that row if it was already changed this week, so history is kept. The new target applies this week: the Week screen's "1 of 3" can become "1 of 4" on a Wednesday, and follows at once.

### Checking in

**Check in** opens a sheet titled with the milestone's line: "How did it go?" with one optional text field for the result, and two buttons, **Hit it** and **Not yet**.

- **Hit it:** the milestone is marked hit with today's date and the result. The screen shows one line, "Milestone hit: Bench 155, squat 300, deadlift 345", and Next moves to the following milestone.
- **Not yet:** the milestone is marked not yet with the result, and stays Next. A card appears under Next check-in:
  - it leads with progress: "You started at bench 145, squat 275, deadlift 315. Now: bench 150, squat 295, deadlift 340." (baseline, then the result just entered; either part is left out if empty);
  - then three choices: **Keep the date**, **Move the date** (pick a new one), **Adjust the milestone** (edit its line and date);
  - each returns the milestone to upcoming, still Next. Until one is picked the card stays (also after a reload), and it never appears anywhere but this screen.
- **Moving a date pushes the later ones out.** When Move the date or Adjust the milestone moves a building or quitting goal's milestone later, every later milestone with a date moves by the same number of days. None goes past the goal's deadline: one that would is set to the deadline. Milestones with no date stay undated. Moving a date earlier pulls nothing in. The date picker stops at the deadline.

For a one-off goal's step the buttons read **Done** and **Not yet**, and the rest is the same, except that moving a step's date moves only that step.

**When every milestone is hit, or there are none, the goal is next.** A goal with no milestones shows Start and Goal on the timeline and "0 of 1 hit". Next check-in shows the goal ("Mar 1", or "Whenever you choose"), and Check in opens the same sheet. **Hit it** marks the goal reached, exactly as End goal → I reached it does. **Not yet** closes the sheet and changes nothing.

A milestone whose date has passed doesn't change by itself in the click-through; "not yet" comes from a check-in or the mock data.

### Pause and End

- **Pause:** the goal becomes paused, at once, no confirmation. Its tasks from this week that aren't done leave the days and the bank, as they do when an aspiration is retired with "Pause them"; done tasks stay. It drops out of Week's progress rows and reads "Paused" on the Aspirations tab and its aspiration's page. **Resume** makes it active again and returns those tasks to this week's bank.
- **Resuming when the aspiration is retired** is allowed. The goal keeps its aspiration, shows under Other goals on the Aspirations tab until the aspiration is brought back, and shows as active (not "Paused") on the retired aspiration's page.
- **End goal:** a sheet that leads with what was achieved: "Started at … Latest …" and "2 of 6 milestones hit". Then **I reached it**, **End it for now** and **Cancel**. The person says which; nothing can tell whether "bench 175" was crossed.
  - Reached: status `reached`. The page then reads "Reached Nov 10" and, when it has an aspiration, "What's next for Be fit?" as plain text, with a quiet **Reopen** in case it was reached by mistake: active again, milestones and tasks as they were.
  - A reached goal counts complete ("6 of 6 hit", here and on the tab): milestones never checked in read "Passed on the way". Their records don't change.
  - Ended: status `ended`. The page reads "Not yet." followed by the same achievement lines, with one action, **Go again**, which makes it active.
  - A reached or ended goal shows no Pause, Check in or Add milestone.
- **No Review.** As on the aspiration page (#13), a Review sheet's choices would only repeat what's already here (edit the target, Pause, End goal), and nothing shows a last-reviewed date.

## Scope

**In:**
- `api/`: `getGoal` and the mutations below; a `notYet` milestone in the mock data.
- `domain/goalDetail.ts`: timeline rows, Next, week labels, next check-in, started/latest lines, achievement summary, `pushedDates` (the push-out rule), and `condenseTimeline(rows)`: which rows always show and the fold rows between them, with their labels.
- `domain/aspirations.ts` and `domain/aspiration.ts`: a resumed goal under a retired aspiration.
- `storage/`: the per-goal "show all" preference.
- `hooks/useGoal.ts`: load, optimistic updates; on a failed save, reload the goal and show a message.
- `screens/GoalDetail.tsx` (replacing #4's placeholder) and the sheets: target, check-in, add milestone, end.
- Docs: mostly there already (timeline, steps as milestones, what Pause does). Add what the build settles: check-in, a not-yet milestone staying next, push-out capped at the deadline, steps in any order, what End does, no goal Review.

**Out (later):**
- Offering to keep a reached goal's practice as a recurring item; a "What's next" button (needs #6).
- Editing the label, measurable line, baseline, aspiration or deadline; deleting or reordering milestones.
- Review, and showing when a goal was last reviewed.
- Quitting goals' daily log and urge rating.
- "This one slipped" for a passed deadline; any prompt that isn't opened by the person.
- Generating tasks from a target, and reflowing the week when a goal is paused or ended (pausing only sets its own tasks aside).
- Amount targets (miles, hours): count targets only, as on Week.

## API changes

```ts
getGoal(goalId: string): Promise<GoalDetail>
// { goal, aspiration?, milestones, weeklyTarget? }: milestones in order; the target in force
// this week, whatever the goal's status.

setWeeklyTarget(goalId: string, amount: number, unit: string): Promise<WeeklyTarget>
addMilestone(goalId: string, milestone: { measurableLine: string; targetDate?: string }): Promise<Milestone>
checkInMilestone(milestoneId: string, outcome: 'hit' | 'notYet', result?: string): Promise<Milestone>
// Building and quitting: only the first milestone that isn't hit. One-off: any step that isn't done.
reopenMilestone(milestoneId: string, changes?: { measurableLine?: string; targetDate?: string }): Promise<Milestone[]>
// Back to upcoming: Keep the date (no changes), Move the date, Adjust the milestone.
// Returns the goal's milestones, since a later date pushes the ones after it out.

pauseGoal(goalId: string): Promise<Goal>    // its not-done tasks this week -> 'skipped'
resumeGoal(goalId: string): Promise<Goal>   // from paused; or from ended (Go again) or reached (Reopen), clearing endedAt; this week's skipped tasks -> 'inBank'
endGoal(goalId: string, outcome: 'reached' | 'ended'): Promise<Goal>   // sets endedAt to today (a day, not an instant)
```

All keep #1's rules: async, return copies, reject unknown IDs and wrong states (checking in a milestone that's already hit, pausing an ended goal, an amount below 1, an empty line). No changes to the entity types.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/goalDetail.ts
export function weekLabel(startDate: string, targetDate: string | undefined): string {
  if (!targetDate) return 'No date'
  return `Wk ${weekNumber(startDate, targetDate)} · ${shortDate(targetDate)}`
}
```

## Testing strategy

- **`domain/goalDetail.test.ts`:** timeline rows and statuses; Next on the first milestone that isn't hit, including a not-yet one; week labels, including no date and Wk 1 for the start week; next check-in with and without a date; started and latest lines with missing parts; achievement summary; "Steps" wording for one-off, and every not-done step checkable; the Goal row counted in the total, Next once every milestone is hit, and hit once the goal is reached; `pushedDates`: later dated ones move by the same days, capped at the deadline, earlier and undated ones stay, moving earlier pulls nothing, one-off moves only the step; `condenseTimeline`: four or fewer shows all, the always-shown rows, fold labels ("Start and 1 hit milestone", "2 more: Wk 16, Wk 20"), a run of one not folded, a not-yet milestone never folded, all hit, none hit.
- **`api/client.test.ts`:** `getGoal` contents and unknown id; each mutation's effect and its rejections; checking in out of order rejects for a building goal and works for a one-off step; reopening with a later date pushes the later milestones out; a target changed twice in a week leaves one row for that week and keeps the old one; `getWeek` reflects a new target and leaves out a paused goal; resume under a retired aspiration.
- **`hooks/useGoal.test.tsx`:** optimistic update; a failed save reloads and shows the message; unknown goal reports not found.
- **`screens/GoalDetail.test.tsx`:** renders the mock goal; edit the target; check in as hit (next milestone shown); with every milestone hit, checking in on the goal marks it reached; the mock's not-yet milestone shows the card (leads with the baseline, then each of the three choices clears it, and moving the date pushes the next one out); add a milestone; Pause (its tasks leave Week) then Resume (they're back in the bank); End as reached and as ended; Go again; a one-off goal reads Steps and Done, and a later step can be marked done first; no dialog is open on first render; a goal with more than four milestones opens condensed, a fold row and Show all expand it, Show less collapses it, and the choice is restored on reopening.
- **`App.test.tsx`:** a remembered goal that doesn't exist lands on Aspirations; back from a goal returns to the tab or to the aspiration it was opened from; the aspiration link opens its page.
- **Manual:** 375 and 390 px, light and dark; a long timeline condensed and expanded (Check in visible without scrolling when condensed); long measurable lines; sheets clear the keyboard and the home indicator.

## Boundaries

- **Always:** every sheet opens only from a tap; "not yet" copy leads with progress since the baseline; keep target history (never overwrite an earlier week's row); run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency (including a date picker; use `<input type="date">`); changes to entity types.
- **Never:** words like "missed", "failed", "behind" or "overdue"; a prompt, badge or reminder to review or check in; moving or removing tasks when a goal is ended, or done tasks ever; a milestone pushed past the goal's deadline.

## Success criteria

- [ ] Every acceptance criterion on #5 is met, except Review, dropped (Nov 10).
- [ ] The weekly target can be set and changed, and Week follows.
- [ ] A check-in records hit or not yet; a not-yet milestone stays Next; the card leads with progress and offers keep, move, adjust; moving a date pushes later ones out, never past the deadline.
- [ ] Pause, Resume, End (reached or ended) and Go again each change the goal as described, and the Aspirations tab reflects it.
- [ ] Milestones can be added; one-off goals read "Steps" and their steps can be done in any order.
- [ ] Nothing opens unprompted; a missing goal returns to Aspirations; back returns where the person came from.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Settled questions

Settled with Jan on 2026-11-10:

1. **Progress since baseline is two lines of text** ("Started at", "Latest"), not a number, because baselines and results are free text.
2. **A new target takes effect this week**, not from next Monday.
3. **End goal asks "reached or not"** rather than working it out.
4. **Two PRs:** the screen with the target edit and Add milestone, then check-in and the actions.
5. **Resuming a goal whose aspiration is retired is allowed;** it shows under Other goals until the aspiration is brought back.
6. **No goal Review,** for the same reasons as the aspiration's.
7. **A not-yet milestone stays Next** until it's hit, rather than being passed over.
8. **Moving a date later pushes the later dated milestones out by the same amount, capped at the deadline.** One-off steps don't push each other.
9. **A one-off goal's steps can be checked in in any order.**

Settled during the phone check, 2026-11-11:

10. **A reached goal counts complete.** Milestones never checked in were passed on the way; they read so, and nothing is written to them.
11. **A reached goal can be reopened,** since Hit it on the goal's own check-in reaches it in one tap.
