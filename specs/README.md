# Specs

One spec per issue, numbered like the issue. This file is the index and the map for the screens still to build. Each spec is planned (`tasks/plan.md`, `tasks/todo.md`) just before it's built, not before. A spec stays a draft until then: it's approved, and its open questions settled, when its plan is written.

## Done

| Spec | Issue |
|---|---|
| [001 Mock data and API client](001-mock-api-client.md) | #1 |
| [002 Today screen](002-today-screen.md) | #2 |
| [003 Week screen](003-week-screen.md) | #3 |
| [004 Aspirations tab](004-aspirations-tab.md) | #4 |
| [013 Aspiration page](013-aspiration-page.md) | #13 |
| [005 Goal detail](005-goal-detail.md) | #5 |
| [006 Add sheet](006-add-sheet.md) | #6 |
| [007 Settings screen](007-settings-screen.md) | #7 |
| [040 API client foundation](040-api-client-foundation.md) | #40 |
| [041 Setup screens on the API](041-setup-screens-on-api.md) | #41 |
| [042 Today, Week and the bank on the API](042-plan-screens-on-api.md) | #42 |

## Remaining (drafted 2026-11-10)

| Module id | Spec | Issue | Responsibility | Depends on |
|---|---|---|---|---|
| `install-instant-open` | [008](008-install-instant-open.md) | #8 | Installs on iPhone, opens offline, comes back where it was | all of the above |

Build order: `aspirations-tab` → `aspiration-page` → `goal-detail` → `add-sheet` → `settings-screen` (done) → `install-instant-open`.

The order follows the model: tab → aspiration → goal. `settings-screen` only needs the tab, so it can move earlier if wanted. `install-instant-open` goes last because it checks that every screen is remembered and works offline.

`aspirations-tab` was `goals-screen` until the app became aspirations first (Nov 10); nothing had been built under the old name.

## Switching to the API (drafted 2026-11-13)

The API is built in twelve slices ([its map](../../api/specs/README.md)). After every slice that adds endpoints, the types here are regenerated and the mock is made to compile against them; the app keeps running on mock data. Screens switch to the real API at four points. Reshaping the mock to the new data model is #30 to #39.

| Module id | Spec | Issue | Responsibility | Comes after API slice |
|---|---|---|---|---|
| `api-client-foundation` | [040](040-api-client-foundation.md) | #40 | Generated types, the mock/real switch, the Aspirations tab on real data (done) | `aspirations` |
| `setup-screens-on-api` | [041](041-setup-screens-on-api.md) | #41 | Aspirations, aspiration and goal screens, and the Add sheet's goal form, on real data (done) | `milestones-check-ins` |
| `plan-screens-on-api` | [042](042-plan-screens-on-api.md) | #42 | Today, Week and the bank; planning rules leave `domain/` (ADR-008) (done) | `planner` |
| `api-by-default` | 043a–d (below) | #43 | Settings, the stored plan, the offline queue; real becomes the default | `settings-sync` |

`install-instant-open` (#8) still goes last, after #43.

### #43 in four parts (drafted 2026-11-20)

#43 bundles four pieces that ship and are checked on their own, so it has four specs and four PRs, each "Part of #43"; #43 closes with the last (settled with Jan, 2026-11-20, with each spec's questions).

| Module id | Spec | Responsibility | Depends on |
|---|---|---|---|
| `real-by-default` | [043a](043a-real-by-default.md) | Real is the default, Settings on the API, each list read once | — |
| `stored-week-and-queue` | [043b](043b-stored-week-and-queue.md) | The week stored on the phone, the queue replayed over it and sent in order (ADR-010) | `real-by-default` |
| `other-screens-offline` | [043c](043c-other-screens-offline.md) | Every other screen opens from its last response; a failed load never empties a screen | `real-by-default`, `stored-week-and-queue` (its storage) |
| `sign-in-around-the-queue` | [043d](043d-sign-in-around-the-queue.md) | The session-ended sheet and banner, sign-out that sends first and clears (ADR-012) | `stored-week-and-queue`, `other-screens-offline` |

Build order: 043a → 043b → 043c → 043d. #43's quitting-goal and delete criteria move to #37 and #38, which build those screens. Its phone checks go with #8.

### After #43 (drafted 2026-11-20)

What the earlier steps left of #17, #37 and #38, and #76, which 038 needs. Each is a draft until its plan is written.

| Module id | Spec | Issue | Responsibility | Depends on |
|---|---|---|---|---|
| `every-failed-save` | [017](017-every-failed-save.md) | #17 | Every failed save shows its message; the screen ends on the server's record | 043c |
| `quitting-goal-daily-answer` | [037](037-quitting-goal-daily-answer.md) | #37 | A quitting goal's daily answer and urge rating, on Today and its page, queued offline | 043b |
| `edit-recurring-item` | [076](076-edit-recurring-item.md) | #76 | Open a recurring item to edit its name, repeat and aspiration; pause and resume it | 017; API #49 (an edit moves this week's work) |
| `delete-mistakes` | [038](038-delete-mistakes.md) | #38 | Delete on tasks, milestones, goals, aspirations and recurring items | `edit-recurring-item` (its sheet holds the item's Delete) |

Order: 017 (small, and it changes the save hooks the others build on) → 037 → 076 → 038.

## Decisions shared by these specs

Settled with Jan on 2026-11-10:

1. **The app is aspirations first:** Aspirations tab → an aspiration → a goal → its milestones. The tab replaces the Goals screen of the Nov 2 sketch. See `../../docs/screens/README.md` and `aspirations.png`.
2. **Tab bar:** Today | Week | + | Aspirations. The + opens the Add sheet over whatever screen is open; it isn't a screen.
3. **Settings is a gear** in the Aspirations header. Settings counts as Aspirations in the tab bar and goes back there.
4. **Aspirations are managed in the click-through:** add, edit the name and why, move up and down, retire and bring back. A new one goes last in priority. (Review was dropped while building #13.)
5. **A one-off goal's steps are its milestones**, and they're called steps everywhere ("Step 3 of 6", never "Stage"). Checking off a task never moves the step; the person marks a step reached on the goal's page. No new entity.
6. **The final milestone is the goal itself.** The timeline's last row is the goal's measurable line, and it counts in "1 of 6". Reaching it is reaching the goal. It isn't a separate milestone record. A goal with no milestones of its own reads "0 of 1".
7. **Goal detail works fully, mocked:** Pause, End and milestone check-in all change data. (Goal Review was dropped while planning #5, as it was for aspirations.)
8. **Goal detail's timeline is vertical**, and condenses past four milestones (spec 005, `goal-detail-timeline.png`).
9. **Adding a goal is a short form.** Milestones and steps are added afterwards on Goal detail. Quitting goals can be created; their daily log comes later.
10. **Past goals are collapsed:** on each aspiration's page, and under Other goals on the tab for goals with no aspiration.
11. **A new task can go straight onto today.** That's the default when the sheet is opened from the Today tab; from anywhere else the bank is.
12. **A new building goal gets this week's bank tasks from the mock**, so the loop from goal to Today can be clicked through.
13. **#8 waits until every screen is built**, and hosting is chosen then. What's already in place (manifest, service worker, remembered screen) stays.
14. **Pausing sets this week's tasks aside**, whether one goal is paused or an aspiration is retired with "Pause them". Tasks placed by hand go too. Recurring items paused by retiring stay off for now.
15. **Keep life running is the special case beside the aspirations:** what has to happen but rolls up to no goal or aspiration (laundry, the trash, a library book, the insurance). It has a row on the Aspirations tab and a page of its own.
16. **The week bar counts sessions only.** Hours and other amounts are left off for now.
17. **Recurring items can repeat "N times a week".** A time of day on a recurring item comes later.

Assumed (say so if wrong):

18. **Navigation stays behind `useNavigation()`.** The `Screen` union grows by `{ screen: 'aspirations' }`, `{ screen: 'aspiration'; aspirationId }`, `{ screen: 'upkeep' }`, `{ screen: 'goal'; goalId; from }` and `{ screen: 'settings' }`, each remembered like the others. `from` is what lets back from a goal return to the tab or to an aspiration. Still no router.
19. **Each spec adds its own `api/` functions, mock data and types.** #2's tests stay as they are; #3's change only where spec 004's new mock goal adds a row.
20. **Nothing here builds the planner.** No week is redrafted and nothing is placed on a day for the person. The one stand-in is decision 12.
21. **Next week is a view on Week** (#46, settled 2026-11-19): from 6 p.m. on Sunday a "This week | Next week" toggle appears, remembered across reloads and gone again once next week has become the current one. Its days open like any day, but nothing in a week that hasn't started can be checked off. **Wrap up this week** sits on Next week and opens a sheet listing what carries over and what ends, from each task's `atClose`; confirming has no undo.
22. **"Still matter?" is a card at the top of Today** (#35, settled 2026-11-19), one per marked task, with Keep, Reschedule and Drop. **Not now** waves it off for the day without answering, and it comes back tomorrow. It never shows how long a task has waited.
23. **The mock imitates the server's answers and nothing more** (ADR-008): `atClose`, `stillMatters` and what wrap-up does are mock rules standing in for the API's, so tests and the click-through (`npm run dev:mock`) keep working. Real is the default since 043a, and the mock stays whole (settled in 043a, replacing 042's "shrinks to what tests need"). Today on mock data after a Sunday-evening wrap-up shows the new current week's days as not yet checkable until the device's date reaches them.

## Shared conventions

Same as 001–003: React 19, TypeScript, Vite, Vitest, oxlint; no new dependencies without asking; no semicolons, single quotes, 2-space indent, `.ts`/`.tsx` imports, named exports; logic in `domain/` and `hooks/`, components render; sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`); screen headers are pinned (`screen-top`).

```bash
nvm use                 # Node 24
npm test
npm run lint
npm run build
npm run dev -- --host   # check on the phone
```
