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

## Remaining (drafted 2026-11-10)

| Module id | Spec | Issue | Responsibility | Depends on |
|---|---|---|---|---|
| `goal-detail` | [005](005-goal-detail.md) | #5 | One goal in full: milestones, weekly target, check-in, Pause / End | `aspirations-tab`, `aspiration-page` |
| `add-sheet` | [006](006-add-sheet.md) | #6 | Add a task, goal, aspiration or recurring item; the + in the tab bar | `aspirations-tab`, `aspiration-page`, `goal-detail` |
| `settings-screen` | [007](007-settings-screen.md) | #7 | Intensity and the few preferences; the gear | `aspirations-tab` |
| `install-instant-open` | [008](008-install-instant-open.md) | #8 | Installs on iPhone, opens offline, comes back where it was | all of the above |

Build order: `aspirations-tab` → `aspiration-page` (done) → `goal-detail` → `add-sheet` → `settings-screen` → `install-instant-open`.

The order follows the model: tab → aspiration → goal. `settings-screen` only needs the tab, so it can move earlier if wanted. `install-instant-open` goes last because it checks that every screen is remembered and works offline.

`aspirations-tab` was `goals-screen` until the app became aspirations first (Nov 10); nothing had been built under the old name.

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

## Shared conventions

Same as 001–003: React 19, TypeScript, Vite, Vitest, oxlint; no new dependencies without asking; no semicolons, single quotes, 2-space indent, `.ts`/`.tsx` imports, named exports; logic in `domain/` and `hooks/`, components render; sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`); screen headers are pinned (`screen-top`).

```bash
nvm use                 # Node 24
npm test
npm run lint
npm run build
npm run dev -- --host   # check on the phone
```
