# Implementation Plan: Add sheet (#6), with the shared message (#19) first

Spec: [`../specs/006-add-sheet.md`](../specs/006-add-sheet.md). Tasks: [`todo.md`](todo.md). (The plan for #5 is in git history at `b0e33b6`; #13's at `255c054`; #4's at `f87a231`.)

## Overview

First #19: one shared message, pinned just above the tab bar, that clears itself. Every screen uses it, and so do the Add sheet's confirmations. Then #6: the + in the tab bar opens one Add sheet over any screen, with Task, Goal, Aspiration and Recurring tabs. Each saves through new `api/` functions against the mock, and the open screen shows the change. An active aspiration's page opens the sheet with that aspiration already selected.

Four PRs, four branches:

- **PR 0, `screen-message`** (closes #19): `useFleetingMessage`, `ScreenMessage`, and the five screens switched over.
- **PR 1, `add-sheet-task`** (Part of #6): the +, the sheet, the Task tab, and the open screen reloading after an add.
- **PR 2, `add-sheet-goal`** (Part of #6): the Goal and Aspiration tabs, and "+ Add a goal for Be fit".
- **PR 3, `add-sheet-recurring`** (closes #6): the Recurring tab, "+ Add recurring", the tab's "Add one with +." hint, and the docs.

## Settled with Jan, 2026-11-11

1. **#19 goes first, in its own PR.** The Add sheet's confirmations use it.
2. **Deadline is offered for every goal type.** It's optional and can't be before the start date (Flow 2 step 6).
3. **Back from a new goal's page** goes to its aspiration's page when it has one, otherwise to the Aspirations tab, whichever screen the sheet was opened over. This uses the existing `GoalOrigin`, so navigation doesn't change.
4. **The repeat choices stay as listed.** Fixed: a weekday, or the 1st–28th of the month. Flexible: once a week, 2–6 times a week, every two weeks, once a month. The rule text matches the mock's: "Every Tuesday", "Monthly on the 1st", "Once a week", "3 times a week", "Every two weeks", "Once a month".
5. **A load failure stays until tapped.** Save failures and confirmations clear after 5 s. A load failure leaves the screen empty behind it, so it doesn't fade. This differs from #19's "clears itself", on purpose.

## Dependency graph

```
useFleetingMessage ──► ScreenMessage ──► Day, Week, Aspiration, Upkeep, Goal detail ── PR 0
        │
        ▼
domain/add.ts (task week, ready) ──► addTask ──┐
dataRevision context ──► hooks reload ─────────┼──► useAdd + AddSheet + TaskForm + the + ── PR 1
                                               │
splitGoalSentence, goal ready ──► addGoal, addAspiration ──► GoalForm ──► AspirationForm,
                                                                          "+ Add a goal for Be fit" ── PR 2
repeatRule, nextDue ──► addRecurringItem ──► RecurringForm, "+ Add recurring", tab hint, docs ── PR 3
```

API tasks share `client.ts`, and form tasks share `AddSheet.tsx` and `useAdd.ts`, so each group runs in order. In each PR, the domain and API task can be built before its form task.

## Architecture decisions

- **The message's timing is a hook.** `useFleetingMessage(message)` returns `{ shown, dismiss }`. A new message, or the same message again after it was cleared, shows and starts a 5 s timer. A tap dismisses it. `ScreenMessage` only renders: `role="status"`, fixed above the tab bar, clear of the home indicator. Screen hooks already clear the message before each save, so a repeated "Couldn't save that." counts as new and restarts the timer.
- **A load failure stays until tapped** (decision 5): when nothing else is on screen, a message that disappears leaves a blank page.
- **One message slot per screen, plus one for the app.** The Add sheet's confirmation is shown by `App`, because the sheet has closed and the screen under it didn't save anything. Messages inside sheets (the Bank sheet's "Couldn't open the bank") stay inline on purpose: the sheet covers the bottom of the screen.
- **The open screen reloads through a data revision.** `hooks/dataRevision.ts` holds a React context, a number that `App` increments after any successful add. The load hooks (`useDay`, `useWeek`, `useAspirations`, `useAspiration`, `useUpkeep`, `useGoal`) list it in their load effect, so they fetch again while the screen keeps showing what it had. There's no remount, no flash and no lost scroll. Without a provider it's 0, so existing tests don't change.
- **`useAdd(origin)` owns the sheet's state:** which tab is open, each tab's draft (kept while the sheet is open, cleared on close), picker data from `getAspirations()` (active goals and active aspirations) loaded when the sheet opens, and saving. A save resolves with what `App` needs next: a confirmation line, a goal to open, or (for an aspiration) staying open on "Saved." with **Add a goal for this** and **Done**.
- **Where the sheet was opened decides its defaults.** `App` passes `{ placement: 'onToday' | 'inBank', aspirationId?, tab? }`. Only the Today screen gives `onToday`, not an opened day, even if that day is today. The aspiration page's links give the tab and the aspiration.
- **The forms are components; the rules are in `domain/add.ts`.** `taskWeek(dueDate, today)`, `taskConfirmation`, `splitGoalSentence`, `goalReady` / `taskReady` / `aspirationReady` / `recurringReady`, `repeatRuleText(choice)` and `nextDue(choice, today)`. The target and date rules reuse `parsedTarget` and `isWithinGoal` from `domain/goalDetail.ts`.
- **"New aspiration" on the Goal tab is two calls**, `addAspiration` and then `addGoal`, made by `useAdd`. If the goal fails after the aspiration saved, the new aspiration becomes the selection, so trying again doesn't make a second one.
- **A new goal opens with the origin from decision 3.** The sheet closes, `goTo({ screen: 'goal', goalId, from })` runs, and the app message reads "Saved. Add milestones when you're ready." ("steps" for one-off).
- **No entity type changes** (spec boundary). A task due in a later week is `inBank` with that week's `weekOf`.

## Phases

0. **PR 0: shared message.** Hook and component, then the five screens. → Checkpoint 0 (phone), PR closes #19.
1. **PR 1: Task.** Spec settled, task rules and `addTask`, data revision, the sheet with the Task tab. → Checkpoint 1 (phone).
2. **PR 2: Goal and Aspiration.** Goal rules and API, Goal tab, Aspiration tab and the aspiration page's goal link. → Checkpoint 2 (phone).
3. **PR 3: Recurring.** Repeat rules and API, Recurring tab and link, docs. → Checkpoint 3, PR closes #6.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A task added "On today" from Today doesn't show, or one added in the bank lands on a day | High | `App.test.tsx` adds from Today and from Week and reads the list and the bank. `addTask` tests check `getDay` and `getBank`. |
| The Goal form is taller than the screen and the keyboard hides Save | High | The sheet scrolls within `max-height` (sheet.css), and Save sits in the form's last row. Checked on the phone at Checkpoint 2 with every field open. |
| The pinned message covers the last row of a list or the tab bar | Med | Screens get bottom padding equal to the message's height only while it shows. Checked at 375 px at Checkpoint 0. |
| Reloading on the revision makes stale requests race (an older load landing after a newer one) | Med | Each load effect already ignores results after cleanup (`current = false`). A hook test bumps the revision twice. |
| A later-week task leaks into this week's bank or Week's counts | Med | `client.test.ts`: a task due next week is absent from `getBank` and `getWeek`, also across the year end. |
| New mock records break the dataset consistency checks | Low | `mockData.test.ts` checks run after each add in `client.test.ts`. |
