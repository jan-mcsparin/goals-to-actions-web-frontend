# Spec: Add sheet (#6)

Status: approved 2026-11-11. Issue: [#6](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/6). Module `add-sheet` in the [map](README.md). Depends on #4, the [aspiration page](013-aspiration-page.md) and #5.

## Objective

One place to add anything, quickly: a task, a goal, an aspiration or a recurring item. The common case, a task, takes a title and one tap. The sheet opens from the + in the tab bar, over whatever screen is open, and closing it leaves the person where they were. An aspiration's page also opens it, already pointed at that aspiration.

References: [Flow 1](../../docs/flows.md#flow-1-name-an-aspiration), [Flow 2](../../docs/flows.md#flow-2-set-a-goal-and-its-milestones), [Flow 3](../../docs/flows.md#flow-3-fill-the-task-bank), [the model](../../docs/product-rules.md#the-model), [`other-screens.png`](../../docs/screens/other-screens.png).

### What the person sees

**Tab bar:** Today | Week | **+** | Aspirations. The + is a button labelled "Add" for screen readers; it's never marked as the current tab.

**The sheet:** titled "Add", with four tabs: Task (open first), Goal, Aspiration, Recurring. Each tab keeps what was typed while the sheet is open; closing the sheet clears it. Save is disabled until the required field is filled. After saving, the sheet closes and a short line confirms where the thing went. The line is the shared screen message (#19), pinned above the tab bar; it clears itself after 5 s or when tapped.

**Task**
- **Title** (required): "Fill out my ballot".
- **Goal:** None, or one of the active goals.
- **Due date:** optional.
- **Time of day:** optional: "by" or "at", and a time.
- **Put it:** "In the bank" or "On today". "On today" is selected to start when the sheet was opened from the Today screen; from anywhere else, "In the bank" is, including a day opened from Week, even when that day is today.
- Where it goes (Flow 3):
  - in the bank, with no due date or due this week or earlier: this week's bank. "Added to this week's bank."
  - in the bank, due in a later week: it waits, and joins the bank of the week it's due. "Saved for the week of Nov 23."
  - on today: it's on today's plan at once, marked placed by hand, whatever its due date. "Added to today."
- It only lands on a day when the person chose "On today".

**Goal**
1. **Type first:** Building, Quitting, One-off. One tap, nothing preselected, and nothing else shows until one is picked. The type can be changed before saving.
2. **One sentence:** "Be strong: bench 175, squat 350, deadlift 400". The text before the first colon is the label, the rest is the measurable line; both are shown back under the field as it's typed. With no colon, the sentence is the label and a second field appears: "How will you know you've got there?" Both are required.
3. **What's this for?** None, an existing aspiration, or "New aspiration", which shows a name field and creates it on save.
4. **Where are you now?** The baseline. Optional.
5. By type:
   - Building: **Weekly target**, a number and a unit ("3", "lifting sessions"). Optional.
   - Quitting: **Start date**, today unless changed.
   - One-off: nothing extra; its steps are added on its page.
6. **Deadline:** optional, for every type (Flow 2 step 6). Not before the start date.

Saving opens the new goal's page, where milestones or steps are added: "Saved. Add milestones when you're ready." ("steps" for one-off). Back from that page goes to its aspiration's page when it has one, otherwise to the Aspirations tab, whichever screen the sheet was opened over.

A building goal saved with a weekly target also gets that many tasks in this week's bank, each titled with the goal's label ("Be strong" three times for a target of 3). This is the mock standing in for the planner, so the goal can be followed from Week to Today.

**Aspiration**
- **Name** (required): "Be fit".
- **What would this give you?** The why. Optional; it saves without one.
- It's placed last in priority order; it can be moved up on its page.
- After saving, the sheet stays open with "Saved." and two buttons: **Add a goal for this** (opens the Goal tab with it selected) and **Done**.

**Recurring**
- **Name** (required): "Take out the trash".
- **Fixed day** or **Flexible**.
  - Fixed: "Every week on" a weekday, or "Every month on the" 1st–28th.
  - Flexible: "Once a week", "2 times a week" up to "6 times a week", "Every two weeks" or "Once a month".
  - The saved rule reads as in the mock: "Every Tuesday", "Monthly on the 1st", "Once a week", "3 times a week", "Every two weeks", "Once a month".
  - Yearly, "every N weeks" and a time of day ("Thursdays at 8 p.m." in the design) are left out for now.
- **Under an aspiration:** optional. With none, it belongs to Keep life running.
- "Added. It will show up in the plan when it's next due." It appears on its aspiration's card, or on the Keep life running page.

## Scope

**In:**
- `api/`: `addTask`, `addGoal`, `addAspiration`, `addRecurringItem`.
- `domain/add.ts`: splitting the goal sentence, which week a task belongs to, repeat-rule text and next due date, what makes each form ready to save.
- `hooks/useAdd.ts`: saving, errors, and telling the open screen to reload.
- `components/AddSheet.tsx` with one form component per tab; the + in `TabBar`; a short confirmation line.
- On an active aspiration's page: "+ Add a goal for Be fit" (Goal tab) and "+ Add recurring" (Recurring tab), each with that aspiration selected. Not on a retired one, to match the pickers. On the Aspirations tab: the footer hint's "Add one with +."
- Reuse what Goal detail built: `useModalDialog` (keeps the sheet above the keyboard), `sheet.css` and `editForm.css`. Focus on open: the Task tab's title field (keyboard up, since it's the one required field); the Goal tab's type choice, with no keyboard until a type is picked.
- The confirmation lines use the shared save/load message from [#19](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/19), so they're seen without scrolling and clear themselves. #19 is built (PR #23). `App` shows them, since the sheet has closed.
- Docs: mostly there already (the + in the tab bar, where a new task goes). Add what the build settles about the four forms.

**Out (later):**
- Tasks for a new recurring item, for later weeks, or after a target is changed (the planner).
- Adding milestones or steps inside the sheet (they're added on Goal detail, #5).
- Placing a new aspiration among the others; an "upcoming" list screen.
- Editing or deleting anything.
- Remembering a half-typed draft across a restart.

## API changes

```ts
addTask(task: { title: string; goalId?: string; dueDate?: string; timeOfDay?: TimeOfDay; onToday?: boolean }): Promise<Task>
// status 'inBank'; weekOf is this week's Monday, or the Monday of the due date's week when that is later.
// With onToday: status 'planned', plannedDay today, weekOf this week, placedByHand.

addGoal(goal: {
  label: string
  measurableLine: string
  type: GoalType
  aspirationId?: string
  baseline?: string
  startDate?: string        // default today
  deadline?: string
  weeklyTarget?: { amount: number; unit: string }   // building only
}): Promise<Goal>
// status 'active'. A weekly target, when given, is stored effective from this week's Monday, and
// `amount` inBank tasks titled with the label are added to this week (a stand-in for the planner).

addAspiration(aspiration: { name: string; why?: string }): Promise<Aspiration>
// priority = last.

addRecurringItem(item: {
  name: string
  repeatRule: string
  fixedDay: boolean
  nextDue: string
  aspirationId?: string
}): Promise<RecurringItem>
```

The mock makes IDs with its own counter (`newId` in `api/client.ts`), not `crypto.randomUUID()`, which is missing over plain http and broke saving on the phone; the real API will make IDs. A goal's weekly target follows the rule `setWeeklyTarget` already enforces (`parsedTarget` in `domain/goalDetail.ts`: a whole number of at least 1, and a unit). `addGoal` rejects a deadline before its start date, as Goal detail does for milestone dates (`isWithinGoal`). All keep #1's rules: async, return copies, reject empty required text (after trimming) and unknown `goalId` / `aspirationId`. No changes to the entity types: a task due in a later week is an `inBank` task with that week's `weekOf`, which `getWeek` and `getBank` already leave out of this week.

The Goal and Aspiration pickers read `getAspirations()` from #4, and offer active goals and active aspirations only.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/add.ts
export function splitGoalSentence(sentence: string): { label: string; measurableLine: string } {
  const [label, ...rest] = sentence.split(':')
  return { label: label.trim(), measurableLine: rest.join(':').trim() }
}
```

## Testing strategy

- **`domain/add.test.ts`:** sentence split (one colon, several, none, extra spaces); task week for no date, this week, a past date, next week and across a year end; repeat-rule text and next due for each choice ("3 times a week" included), including a monthly day already past this month; ready-to-save rules.
- **`api/client.test.ts`:** each add function stores and returns the record with its defaults; a task due later is absent from `getBank` and `getWeek`; a task added on today is in `getDay(today)` with `placedByHand`; a goal with a target shows in `getWeek`'s targets with that many bank tasks; rejections, including a deadline before the start date and a target that isn't a whole number of at least 1; new records pass the dataset consistency checks.
- **`components/AddSheet.test.tsx`:** Task is open first and saves with only a title; "In the bank" is selected at first, or "On today" when opened from Today, and "On today" passes `onToday`; Save disabled when empty; Goal shows nothing but the three types until one is picked; the second field appears without a colon; "New aspiration" creates both; Aspiration saves without a why and "Add a goal for this" opens the Goal tab with it selected; each Recurring choice saves the right rule; typed text survives switching tabs and is cleared on close.
- **`App.test.tsx`:** the + opens the sheet on any screen and isn't marked current; a task added while on Week appears in the bank; each link on an aspiration's page opens its tab with the aspiration selected; the sheet opened from Today has "On today" selected and the saved task appears in the list; opened from Week, Goals or an opened day it has "In the bank" selected; saving a goal opens its page.
- **Manual:** 375 and 390 px, light and dark; the keyboard doesn't cover the field in use or Save; date and time inputs on iOS; the sheet scrolls when the Goal form is taller than the screen.

## Boundaries

- **Always:** a task needs only a title; goal type is picked by the person, never guessed from the sentence; use native `<input type="date">` and `<input type="time">`; run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency; changes to entity types; putting a new task on any day other than today.
- **Never:** required fields beyond the ones marked; a nudge to add a why, a deadline or an aspiration after the person skipped it; changing what's on Today unless the person chose "On today".

## Success criteria

- [ ] Every acceptance criterion on #6 is met.
- [ ] Tab bar is Today | Week | + | Aspirations, and the + opens the sheet from every screen.
- [ ] "+ Add a goal for Be fit" and "+ Add recurring" on an aspiration's page open the right tab with that aspiration selected.
- [ ] A task saves with only a title and goes to this week's bank, waits for its week when due later, or goes onto today when asked.
- [ ] A new building goal with a target has that many tasks in this week's bank.
- [ ] A goal's type is picked first; the sentence splits into label and measurable line; saving opens the goal's page.
- [ ] An aspiration saves with or without a why and offers "Add a goal for this".
- [ ] A recurring item saves as fixed or flexible with a readable repeat rule.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.
