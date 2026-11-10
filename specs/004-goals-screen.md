# Spec: Goals screen (#4)

Status: draft 2026-11-10, awaiting approval. Issue: [#4](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/4). Module `goals-screen` in the [map](README.md). Depends on #1–#3 (done).

## Objective

The Goals screen shows the whole picture at a glance: each aspiration with its why, the goals under it, and how far each goal has come. It's opened weekly or less. Tapping a goal opens it.

It also adds the Goals tab and the navigation that Goal detail (#5) and Settings (#7) hang from.

References: [Flow 1](../../docs/flows.md#flow-1-name-an-aspiration), [Flow 6](../../docs/flows.md#flow-6-see-progress-and-check-in-at-milestones), [`other-screens.png`](../../docs/screens/other-screens.png), [screens README](../../docs/screens/README.md#goals-goal-detail-add-settings), [product rules](../../docs/product-rules.md).

### What the person sees

- **Header (pinned):** "Goals". (The gear arrives with #7.)
- **Aspirations**, in priority order. For each:
  - its name ("Be fit") and, under it, its why if it has one;
  - its active and paused goals, one row each;
  - with no goals: "No goals yet."
- **Goal row** (a button that opens the goal):
  - the label ("Be strong");
  - on the right, progress: "Milestone 1 of 4" for building and quitting goals, "Stage 3 of 6" for one-off goals. The goal itself is the final milestone, so the total is the goal's milestones plus one, and the count is milestones hit, plus one once the goal is reached;
  - a progress bar under it, filled to the same fraction;
  - a goal with no milestones of its own reads "Milestone 0 of 1" ("Stage 0 of 1") with an empty bar, since the goal is still its final milestone;
  - a paused goal reads "Paused" in place of the count.
- **Other goals:** active and paused goals with no aspiration, under the heading "Other goals". Left out when there are none.
- **Past goals:** reached and ended goals, behind a closed "Past goals (2)" row at the bottom. Tapping it opens the list: each a plain row with "Reached" or "Ended" on the right, still tappable. It starts closed every time. Left out when there are none.
- **Recurring items:** "Recurring items: 3", the count of active ones. Not a link.
- **Nothing set up at all:** "Nothing here yet. Start with one sentence: a goal, or who you want to be."

No pacing, no warnings, no "behind" on this screen.

**Tab bar:** Today | Week | Goals. (The + arrives with #6, between Week and Goals.) An opened goal counts as Goals.

**Opening a goal:** goes to `{ screen: 'goal', goalId }`. Until #5 is built, that screen is a placeholder showing the goal's label and "‹ Goals". The open screen, including an opened goal, is restored after a reload or iOS restart.

## Scope

**In:**
- `api/`: `getGoals()`, the `GoalsOverview` type, more mock goals and milestones.
- `domain/goals.ts`: grouping, ordering, progress counts and labels.
- `hooks/useGoals.ts`; `screens/Goals.tsx` (past goals in a native `<details>`); a placeholder `screens/GoalDetail.tsx`.
- `storage/navigation.ts`, `useNavigation`, `App.tsx`, `TabBar`: the `goals` and `goal` screens and the third tab.
- Docs: screens README (Goals: past goals, other goals, what the count means; the tab bar).

**Out (later):**
- Goal detail's content (#5), the + and Add sheet (#6), the gear (#7).
- Editing, reordering or opening an aspiration.
- Moving past goals to an archive of their own.
- A list of recurring items.
- This week's pacing per goal (it lives on Week).

## API changes

```ts
getGoals(): Promise<GoalsOverview>

export type GoalsOverview = {
  aspirations: Aspiration[]
  goals: Goal[]            // every status
  milestones: Milestone[]  // for those goals, in each goal's order
  recurringItemCount: number // active recurring items
}
```

Same rules as #1: async, returns copies. Ordering and grouping are left to `domain/`.

## Mock dataset

Additions only; today's and this week's tasks are untouched so #2's and #3's tests keep their counts.

- **Clear out the garage** (one-off) gets five milestones as its steps, three hit ("Stage 3 of 6", the goal being the sixth).
- A second goal under Be fit: **Be fast** (building, "Run a 7-minute mile", baseline "8:40 mile"), three milestones, one hit ("Milestone 1 of 4"), no weekly target, so the Week screen is unchanged.
- One **paused** goal and one **reached** goal, so both states can be seen.
- One active goal with **no aspiration**.
- "Keep a calm home" keeps having no why.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/goals.ts
// total counts the goal itself as the final milestone, so it is never 0.
export function progressLabel(type: GoalType, hit: number, total: number): string {
  return `${type === 'oneOff' ? 'Stage' : 'Milestone'} ${hit} of ${total}`
}
```

## Testing strategy

- **`domain/goals.test.ts`:** aspirations in priority order; goals grouped under their aspiration; other and past groups; hit and total counts, with the goal as the final one; labels for each goal type; "0 of 1" with no milestones and "1 of 1" once reached; paused.
- **`api/client.test.ts`:** `getGoals` returns every goal, their milestones and the active recurring count; returns copies. Dataset consistency test still passes.
- **`storage/navigation.test.ts`:** `goals` and `goal` round-trip; a `goal` with no id falls back to Today.
- **`screens/Goals.test.tsx`:** aspirations with their why; a goal row's count and bar; "Stage 3 of 6"; Paused; Past goals closed at first and listed once opened; the recurring count; tapping a goal calls `onOpenGoal` with its id.
- **`App.test.tsx`:** the third tab; an opened goal marks Goals as current and survives a remount.
- **Manual:** 375 and 390 px, light and dark; long labels wrap without pushing the count off screen.

## Boundaries

- **Always:** navigate through `useNavigation()`; keep `domain/` free of React; run test, lint and build before each commit; update `../docs/` in the same work.
- **Ask first:** any new dependency; new fields on `Goal`, `Milestone` or `Aspiration`.
- **Never:** pace, "behind" or shame wording; prompts of any kind on this screen; changes to today's or this week's mock tasks.

## Success criteria

- [ ] Every acceptance criterion on #4 is met.
- [ ] Aspirations show in priority order with their why; goals show milestone or stage progress as described.
- [ ] Paused, past (collapsed) and aspiration-less goals each show as described.
- [ ] Tapping a goal opens its (placeholder) screen; "‹ Goals" returns; both survive reload.
- [ ] Tab bar is Today | Week | Goals.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass; #2's and #3's tests are unchanged.
- [ ] Works at 375 and 390 px, light and dark.

## Open questions

1. **"Other goals"** as the heading for goals with no aspiration. Flow 1 says the app may offer to add an aspiration when a goal has none; that offer is left for later.
2. **Recurring items** are only counted. Where they're listed and edited isn't in any issue yet.
