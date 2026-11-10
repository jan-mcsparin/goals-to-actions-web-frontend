# Spec: Aspiration page

Status: draft 2026-11-10, awaiting approval. Issue: not created yet; this file takes the issue's number when it exists. Module `aspiration-page` in the [map](README.md). Depends on #4.

## Objective

One aspiration in full: its why, how its week is going, its goals, its recurring items and its past goals. It's also where an aspiration is managed, only when the person chooses: edit the name and why, move it up or down in priority, review it, retire it, bring it back.

Everything works against the mock, and the Aspirations tab, Week and Today reflect it.

References: [Flow 1, "Managing aspirations afterwards"](../../docs/flows.md#flow-1-name-an-aspiration), [Flow 7](../../docs/flows.md#flow-7-rollovers-and-light-reviews), [`aspirations.png`](../../docs/screens/aspirations.png) (middle and right phones), [screens README](../../docs/screens/README.md#aspirations-aspiration-goal-detail-add-settings), [tone rules](../../docs/product-rules.md#tone-and-prompts).

### What the person sees

- **Header (pinned):** "‹ Aspirations" on the left, "Aspiration" on the right. Then the name and the why.
- **This week:** "2 of 5 · 6 days left" and a bar. The count is the one on the tab (spec 004); days left runs today through Sunday, as on Week. Left out when none of its goals has a weekly target.
- **Goals**, with "3 active" beside the heading. One card per active goal, each a button that opens the goal:
  - the label and "Milestone 1 of 6" (or "Step");
  - the measurable line;
  - a bar for milestone progress;
  - "This week: 1 of 3 lifting sessions", or "No weekly target yet" for a building goal without one. One-off and quitting goals have no week line.
  - Paused goals follow the active ones, as the same card with "Paused" in place of the count.
- **+ Add a goal for Be fit:** arrives with #6 (Add sheet, Goal tab, this aspiration selected).
- **Recurring:** its active recurring items (on a retired aspiration's page, the ones it paused, marked "Paused"), name on the left and repeat rule on the right. **+ Add recurring** arrives with #6.
- **Past goals (1):** closed to start; reached and ended goals with "Reached" or "Ended", each opening the goal.
- **Priority:** "1st of 3 aspirations", "Comes first when goals compete for time", and two buttons, move up and move down. The one that can't apply is disabled.
- **Actions:** Edit name and why · Review · Retire.

**An aspiration that isn't there** (a remembered id after the mock data reset): go back to Aspirations, quietly.

### Edit name and why

A sheet with the name (required) and the why (optional, "What would this give you?"). Save updates both.

### Reorder

Move up and move down swap this aspiration with its neighbour among the active ones, at once. The new order shows on the Aspirations tab, in Week's progress rows and in Today's By goal view, which already sort by priority.

### Review

A sheet, only when tapped: the name, "Still the right aspiration?" and "Still in the right place?" with "1st of 3". Four choices: **Keep as is**, **Edit name and why** (opens that sheet), **Move it** (closes the sheet at the Priority section), **Retire** (opens the Retire sheet). Each records today as the last review. Nothing ever asks the person to review.

### Retire

A sheet titled "Retire Be fit?":

- It leads with the aspiration's history: "Since March: 1 goal reached, 3 goals active, 2 recurring items." (the month it was created; parts with a zero are left out).
- "What should happen to its goals and recurring items?" One choice:
  - **Pause them** (selected to start): "They leave your days. Resume any of them later." Its active goals become paused and its recurring items inactive. Their tasks from this week that aren't done leave the days and the bank; done tasks stay as they are.
  - **Keep them going:** "They carry on without an aspiration, under Other goals." Its active and paused goals and its recurring items lose their aspiration; nothing else about them changes.
- "Be fit moves to Retired, with its history. You can bring it back anytime."
- **Retire Be fit** and **Cancel**.

Afterwards the app returns to the Aspirations tab, where Be fit is under Retired. Its reached and ended goals stay with it either way.

### A retired aspiration's page

The same page, quieter: the name, the why, "Retired Nov 10", its past goals, any goals paused by retiring (each still opens, and can be resumed there), and one action: **Bring back**. No This week, no Priority, no Edit, Review or Retire.

**Bring back** makes it active again, last in priority. Goals it paused stay paused until resumed one by one. Recurring items it paused stay off too; there's no way to turn one back on until recurring items get controls of their own. Goals that were kept going stay under Other goals.

## Scope

**In:**
- `api/`: `getAspiration` and the mutations below.
- `domain/aspiration.ts`: goal cards and their week lines, the priority line ("1st of 3"), the history line, what a retired page shows.
- `hooks/useAspiration.ts`: load, optimistic updates, rollback with a message on failure.
- `screens/Aspiration.tsx` (replacing #4's placeholder) and the sheets: edit, review, retire.
- Docs: none expected; flows.md and the screens README already describe this. Add the detail on what "leave your days" does to tasks.

**Out (later):**
- The two "+ Add" links (#6).
- Dragging to reorder; setting priority while adding an aspiration.
- Pausing, editing or removing a single recurring item.
- Deleting an aspiration.
- The planner using priority when the week is tight; reflowing a week after retiring.

## API changes

```ts
getAspiration(aspirationId: string): Promise<AspirationDetail>
// { aspiration, goals, milestones, recurringItems, weeklyTargets, weekTasks, activeCount }:
// its goals of every status, its recurring items (active and paused), this week's targets
// and goal tasks, and how many active aspirations there are (for "1st of 3").

updateAspiration(aspirationId: string, changes: { name?: string; why?: string }): Promise<Aspiration>
moveAspiration(aspirationId: string, direction: 'up' | 'down'): Promise<Aspiration[]>
// Swaps priority with the neighbouring active aspiration; returns the active ones in order.

reviewAspiration(aspirationId: string): Promise<Aspiration>   // sets lastReviewedAt
retireAspiration(aspirationId: string, itsWork: 'pause' | 'keep'): Promise<Aspiration>
// status 'retired', retiredAt today. 'pause': active goals -> paused, recurring items -> inactive,
// their not-done tasks this week -> 'skipped'. 'keep': goals and recurring items lose aspirationId.
bringBackAspiration(aspirationId: string): Promise<Aspiration>
// status 'active', retiredAt cleared, priority last.
```

All keep #1's rules: async, return copies, reject unknown IDs, an empty name, retiring a retired aspiration and moving one. Tasks set aside by retiring use the existing `skipped` status; no new fields.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/aspiration.ts
export function priorityLine(position: number, activeCount: number): string {
  return `${ordinal(position)} of ${activeCount} ${activeCount === 1 ? 'aspiration' : 'aspirations'}`
}
```

## Testing strategy

- **`domain/aspiration.test.ts`:** goal cards (active, then paused) and their week lines, including "No weekly target yet" and none for one-off; the priority line for first, second, third and one of one; which move buttons apply; the history line with zeros left out; what a retired page shows.
- **`api/client.test.ts`:** `getAspiration` contents and unknown id; `updateAspiration`; `moveAspiration` at each end and in the middle, skipping retired ones; `retireAspiration` with `pause` (goals, recurring items, this week's tasks, done tasks untouched) and with `keep`; `bringBackAspiration` (last in priority, paused goals still paused); rejections; `getWeek` leaves out a retired aspiration's paused goals.
- **`hooks/useAspiration.test.tsx`:** optimistic update and rollback for one mutation; unknown aspiration reports not found.
- **`screens/Aspiration.test.tsx`:** renders the mock aspiration; a goal card opens the goal; edit the name and why; move down then up, with the end buttons disabled; Review records the date and each choice leads where described; Retire leads with the history, "Pause them" is selected at first, and each choice does what it says; a retired page shows only Bring back; no dialog is open on first render.
- **`App.test.tsx`:** after retiring, the tab shows it under Retired; a remembered aspiration that doesn't exist lands on Aspirations; reordering changes the card order on the tab.
- **Manual:** 375 and 390 px, light and dark; a long why; the Retire sheet fits without scrolling at 375 px.

## Boundaries

- **Always:** every sheet opens only from a tap; Retire leads with what the aspiration has seen; history is kept (nothing is deleted); run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency; fields beyond those in `../docs/data-model.md`; deleting anything.
- **Never:** words like "abandon", "give up", "failed" or "quit"; a prompt, badge or reminder to review or reorder; changing a day's tasks for any reason other than "Pause them".

## Success criteria

- [ ] The page shows the name, why, this week, goal cards, recurring items, past goals and priority as in `aspirations.png`.
- [ ] Name and why can be edited; the aspiration can be moved up and down, and the tab, Week and Today's By goal view follow.
- [ ] Review works and is never prompted.
- [ ] Retire works with both choices; the aspiration moves to Retired with its history.
- [ ] Bring back makes it active, last in priority, with its paused goals still paused.
- [ ] A missing aspiration returns to Aspirations.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Decisions

1. **"They leave your days" is literal** (Jan, Nov 10). With "Pause them", not-done tasks from this week for those goals and recurring items come off the days and out of the bank, including ones placed by hand. Pausing a single goal (spec 005) does the same.
2. **Paused goals are listed** after the active ones, so they can be reached and resumed.
3. **Recurring items paused by retiring stay off** after Bring back, for now.

## Open questions

1. **Resuming a goal whose aspiration is retired.** Allowed; the goal then shows under Other goals on the tab until the aspiration is brought back. The alternative is to offer Bring back instead.
2. **This needs an issue.** Shall I create one from the task template? The spec then takes its number.
