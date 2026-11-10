# Spec: Aspirations tab (#4)

Status: approved 2026-11-10, with its plan (`tasks/plan.md`). Issue: [#4](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/4). Module `aspirations-tab` in the [map](README.md). Depends on #1–#3 (done).

Rewritten on 2026-11-10: the app is aspirations first, so this tab replaces the Goals screen of the Nov 2 sketch.

## Objective

The Aspirations tab shows the whole picture at a glance, organised the way the model is: each aspiration in priority order, with its why, how its week is going, its goals and their progress, and its recurring items. It's opened weekly or less. A card opens the aspiration; a goal row opens the goal.

It also adds the third tab and the navigation that the aspiration page, Goal detail (#5) and Settings (#7) hang from.

References: [Flow 1](../../docs/flows.md#flow-1-name-an-aspiration), [Flow 6](../../docs/flows.md#flow-6-see-progress-and-check-in-at-milestones), [`aspirations.png`](../../docs/screens/aspirations.png) (left phone), [screens README](../../docs/screens/README.md#aspirations-aspiration-goal-detail-add-settings), [product rules: the model](../../docs/product-rules.md#the-model).

### What the person sees

- **Header (pinned):** "Aspirations". (The gear arrives with #7.)
- **One card per active aspiration**, in priority order:
  - the name ("Be fit") with a chevron, and its why under it if it has one. This top part is a button that opens the aspiration's page;
  - **This week:** a bar and "2 of 5 this week", across all its goals (rules below). Left out when none of its goals has a weekly target;
  - **its active and paused goals**, one row each, each a button that opens the goal:
    - the label ("Be strong");
    - on the right, "Milestone 1 of 6" for building and quitting goals, "Step 4 of 6" for one-off goals; a one-off goal with a deadline adds "· by Dec 15";
    - a paused goal reads "Paused" in place of the count;
  - **its recurring items** on one line: "2 recurring: Stretch, Hockey", or "No recurring items";
  - with no goals: "No goals yet."
- **Other goals:** active and paused goals with no aspiration, as the same rows, then their reached and ended goals behind a closed "Past goals (2)" row. Left out when there are none of either.
- **Keep life running:** a row with "5 recurring" and a chevron, always shown. It opens the Keep life running page (below).
- **Retired (1):** closed to start. Opened, it lists retired aspirations by name; each opens its page.
- **Footer hint:** "In order of priority. The first comes first when goals compete for time. Add one with +." (The last sentence arrives with #6.)
- **Nothing set up at all:** "Nothing here yet. Start with one sentence: a goal, or who you want to be."

No pacing line, no warnings and no "behind" on this screen.

### Counting milestones

The goal itself is the final milestone. The total is the goal's milestones plus one; the count is milestones hit, plus one once the goal is reached. A goal with no milestones of its own reads "Milestone 0 of 1" ("Step 0 of 1"). One-off goals say "Step" everywhere, to match "Steps" on Goal detail.

### This week, per aspiration

For the aspiration's active building goals that have a count target this week:

- **Total:** the sum of their targets (3 lifting sessions + 2 runs = 5).
- **Done:** this week's done tasks for those goals, each goal counted up to its own target (so one goal done twice over can't hide another).
- The line reads "2 of 5 this week". No unit, because goals under one aspiration count different things.

Amount targets (hours, miles) aren't counted yet, as on Week, so the design's "2 of 7 hours this week" is left off.

### Keep life running

Keep life running is the special case beside the aspirations: everything that has to happen but rolls up to no goal or aspiration. Laundry, taking out the trash, returning a library book, renewing the insurance. It's the same group Today shows under that name.

Its page:

- **Header (pinned):** "‹ Aspirations" and "Keep life running", with one line under it: "The things that have to happen, under no goal."
- **Recurring:** the active recurring items with no aspiration, name on the left and repeat rule on the right ("Take out the trash · Every Tuesday"). None: "No recurring items."
- **To do:** tasks with no goal and no recurring item that aren't done, from this week and later: the title, then its day ("Thursday"), "In the bank", or "Week of Nov 23", and "due Nov 12" when it has a due date. None: "Nothing waiting."
- The page only shows. Checking off and placing happen on Today and Week; adding arrives with #6.

### Navigation

- **Tab bar:** Today | Week | Aspirations. (The + arrives with #6, between Week and Aspirations.) An opened aspiration, goal or Keep life running counts as Aspirations.
- **Opening an aspiration** goes to `{ screen: 'aspiration', aspirationId }`. Until the [aspiration page](013-aspiration-page.md) is built, that's a placeholder with the name and "‹ Aspirations".
- **Opening Keep life running** goes to `{ screen: 'upkeep' }`.
- **Opening a goal** goes to `{ screen: 'goal', goalId, from }`, where `from` records where the person came from, so back returns there. Until #5 it's a placeholder with the label and a back link.
- The open screen, including an opened aspiration or goal, is restored after a reload or iOS restart.

## Scope

**In:**
- `api/`: `getAspirations()`, `getUpkeep()`, the `AspirationsOverview` and `Upkeep` types, `status` and `retiredAt` on `Aspiration`, more mock data.
- `domain/aspirations.ts`: cards in priority order, goal rows and their counts and labels, the week count, other goals, upkeep, retired.
- `domain/upkeep.ts`: the recurring rows and the to-do rows with where each one sits.
- `hooks/useAspirations.ts`, `hooks/useUpkeep.ts`; `screens/Aspirations.tsx`, `screens/Upkeep.tsx`; placeholder `screens/Aspiration.tsx` and `screens/GoalDetail.tsx`.
- `storage/navigation.ts`, `useNavigation`, `App.tsx`, `TabBar`: the `aspirations`, `aspiration`, `goal` and `upkeep` screens and the third tab.
- Docs: none expected; the screens README already describes this tab and the Keep life running page. Fix it if the build settles a detail.

**Out (later):**
- The aspiration page's content and everything it does: edit, reorder, review, retire, bring back ([aspiration page](013-aspiration-page.md)).
- Goal detail's content (#5), the + and Add sheet (#6), the gear (#7).
- Editing or pausing a recurring item; doing anything from the Keep life running page.
- A pacing line per aspiration ("6 days left" appears on the aspiration page only).

## API changes

```ts
getAspirations(): Promise<AspirationsOverview>

export type AspirationsOverview = {
  aspirations: Aspiration[]        // active and retired
  goals: Goal[]                    // every status
  milestones: Milestone[]          // for those goals, in each goal's order
  recurringItems: RecurringItem[]  // active ones
  weeklyTargets: WeeklyTarget[]    // the target in force this week, per active goal
  weekTasks: Task[]                // this week's tasks that belong to a goal
}

getUpkeep(): Promise<Upkeep>

export type Upkeep = {
  recurringItems: RecurringItem[]  // active, with no aspiration
  tasks: Task[]                    // not done, no goal and no recurring item, this week and later
}

export type Aspiration = {
  // ...as now, plus:
  status: 'active' | 'retired'
  retiredAt?: string
}
```

Same rules as #1: async, returns copies. Ordering, grouping and counting are left to `domain/`. `Aspiration.status` follows `../docs/data-model.md`; every aspiration in the mock data gets `status: 'active'` except the retired one below.

## Mock dataset

The names in `aspirations.png` are examples; the mock keeps "Keep a calm home" and "Clear out the garage" so #2's tests stand. Today's tasks are untouched.

- **Be fit** gets the three goals from the product rules:
  - **Be strong**: five milestones (one hit, one not yet, three upcoming), so it reads "Milestone 1 of 6" as in the design.
  - **Have endurance** (building, "Run 10k in under 50 minutes", target 2 runs): three milestones, two hit; one run done earlier this week and one in the bank.
  - **Look good** (building, "Body fat at 15%"): two milestones, none hit, no weekly target.
- **Clear out the garage** (one-off) gets five milestones as its steps, three hit ("Step 3 of 6").
- Two recurring items under Be fit (Stretch, Hockey); the existing three stay as they are.
- One **paused** goal and one **reached** goal under an aspiration; one active goal with **no aspiration** and a deadline; one **retired** aspiration with a reached goal.
- "Keep a calm home" keeps having no why.

Have endurance adds a second progress row and one bank task to the Week screen, so #3's tests that count those are updated in the same change.

## Code style

As in the [shared conventions](README.md#shared-conventions).

```ts
// domain/aspirations.ts
// total counts the goal itself as the final milestone, so it is never 0.
export function progressLabel(type: GoalType, hit: number, total: number): string {
  return `${type === 'oneOff' ? 'Step' : 'Milestone'} ${hit} of ${total}`
}
```

## Testing strategy

- **`domain/aspirations.test.ts`:** cards in priority order, retired ones apart; goals grouped under their aspiration, paused included, past ones left out of cards; counts with the goal as the final milestone, "0 of 1" with none and "1 of 1" once reached; labels per goal type and the deadline suffix; the week count (two goals summed, a goal capped at its target, no targets gives no bar, paused goals left out); the recurring line; other goals and their past goals; the upkeep count.
- **`domain/upkeep.test.ts`:** recurring rows; a to-do row for a task on a day, in the bank and in a later week; the due date; done tasks left out; both empty states.
- **`api/client.test.ts`:** `getAspirations` contents; `getUpkeep` leaves out goal tasks, recurring tasks, done tasks and items under an aspiration; returns copies; the dataset consistency test still passes with the new records and `status`.
- **`storage/navigation.test.ts`:** `aspirations`, `aspiration`, `upkeep` and `goal` (with `from`) round-trip; a missing id falls back to Today.
- **`screens/Aspirations.test.tsx`:** a card's name, why, week line, goal rows and recurring line; "Step 3 of 6"; Paused; tapping the card top opens the aspiration and a goal row opens the goal; Other goals with past goals closed; the Keep life running row opens its page; Retired closed at first.
- **`screens/Upkeep.test.tsx`:** the mock's recurring items and loose tasks ("Fill out my ballot" with its due date); nothing on the page is a control except back.
- **`App.test.tsx`:** the third tab; an opened aspiration or goal marks Aspirations as current and survives a remount.
- **Manual:** 375 and 390 px, light and dark; long labels wrap without pushing the count off screen; the card's two tap targets (card top, goal row) are easy to hit apart.

## Boundaries

- **Always:** navigate through `useNavigation()`; keep `domain/` free of React; run test, lint and build before each commit; update `../docs/` in the same work if behaviour changes.
- **Ask first:** any new dependency; fields beyond `status` and `retiredAt` on `Aspiration`; changes to today's mock tasks.
- **Never:** pace, "behind" or shame wording; prompts of any kind on this screen.

## Success criteria

- [ ] Every acceptance criterion on #4 is met, read as the Aspirations tab.
- [ ] Active aspirations show as cards in priority order with why, this week, goals and recurring items.
- [ ] Goal rows show milestone or step progress with the goal as the final milestone.
- [ ] Other goals and Retired show as described; Keep life running opens its page, which lists recurring items and loose tasks under no goal.
- [ ] One-off goals read "Step" everywhere.
- [ ] A card opens its aspiration and a goal row opens its goal (placeholders); back returns; all of it survives reload.
- [ ] Tab bar is Today | Week | Aspirations.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Works at 375 and 390 px, light and dark.

## Open questions

None. The Keep life running page is show-only (Jan, Nov 10).
