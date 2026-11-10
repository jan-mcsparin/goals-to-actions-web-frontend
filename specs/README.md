# Specs

One spec per issue, numbered like the issue. This file is the index and the map for the screens still to build. Each spec is planned (`tasks/plan.md`, `tasks/todo.md`) just before it's built, not before.

## Done

| Spec | Issue |
|---|---|
| [001 Mock data and API client](001-mock-api-client.md) | #1 |
| [002 Today screen](002-today-screen.md) | #2 |
| [003 Week screen](003-week-screen.md) | #3 |

## Remaining (drafted 2026-11-10)

| Module id | Spec | Issue | Responsibility | Depends on |
|---|---|---|---|---|
| `goals-screen` | [004](004-goals-screen.md) | #4 | Aspirations with their goals and progress; the Goals tab; `getGoals` | — |
| `goal-detail` | [005](005-goal-detail.md) | #5 | One goal in full: milestones, weekly target, check-in, Review / Pause / End | `goals-screen` |
| `add-sheet` | [006](006-add-sheet.md) | #6 | Add a task, goal, aspiration or recurring item; the + in the tab bar | `goals-screen`, `goal-detail` |
| `settings-screen` | [007](007-settings-screen.md) | #7 | Intensity and the few preferences; the gear | `goals-screen` |
| `install-instant-open` | [008](008-install-instant-open.md) | #8 | Installs on iPhone, opens offline, comes back where it was | all of the above |

Build order: `goals-screen` → `goal-detail` → `add-sheet` → `settings-screen` → `install-instant-open`.

`settings-screen` only needs `goals-screen`, so it can move earlier if wanted. `install-instant-open` goes last because it checks that every screen is remembered and works offline.

## Decisions shared by 004–008

Settled with Jan on 2026-11-10:

1. **Tab bar:** Today | Week | + | Goals. The + opens the Add sheet over whatever screen is open; it isn't a screen.
2. **Settings is a gear**, not a tab.
3. **Aspirations have no page of their own.** They're the headings on the Goals screen.
4. **A one-off goal's steps are its milestones.** "Stage 3 of 6" is 3 hit of 6, the goal itself being the sixth. Checking off a task never moves the stage; the person marks a step reached on the goal's page. No new entity.
5. **Goal detail works fully, mocked:** Pause, End, Review and milestone check-in all change data.
6. **Adding a goal is a short form.** Milestones and steps are added afterwards on Goal detail. Quitting goals can be created; their daily log comes later.
7. **The gear sits in the Goals header**, top right, where the sketch has "+ Add". Settings counts as Goals in the tab bar and goes back to Goals.
8. **Past goals are collapsed** at the bottom of Goals.
9. **A new task can go straight onto today.** That's the default when the sheet is opened from the Today tab; from anywhere else the bank is.
10. **A new building goal gets this week's bank tasks from the mock**, so the loop from goal to Today can be clicked through.
11. **Goal detail's timeline is vertical**, and condenses past four milestones (spec 005).
12. **The final milestone is the goal itself.** The timeline's last row is the goal's measurable line, and it counts in "1 of 6". Reaching it is reaching the goal. It isn't a separate milestone record.
13. **#8 waits until #4–#7 are built**, and hosting is chosen then. What's already in place (manifest, service worker, remembered screen) stays.

Assumed (say so if wrong):

14. **Navigation stays behind `useNavigation()`.** The `Screen` union grows by `{ screen: 'goals' }`, `{ screen: 'goal'; goalId }` and `{ screen: 'settings' }`, each remembered like the others. Still no router.
15. **Each spec adds its own `api/` functions, mock data and types**, and keeps #2's and #3's tests passing unchanged.
16. **Nothing here builds the planner.** No week is redrafted and nothing is placed on a day for the person. The one stand-in is decision 10.

## Shared conventions

Same as 001–003: React 19, TypeScript, Vite, Vitest, oxlint; no new dependencies without asking; no semicolons, single quotes, 2-space indent, `.ts`/`.tsx` imports, named exports; logic in `domain/` and `hooks/`, components render; sheets use the native `<dialog>` pattern (`components/sheet.css`, `useModalDialog`); screen headers are pinned (`screen-top`).

```bash
nvm use                 # Node 24
npm test
npm run lint
npm run build
npm run dev -- --host   # check on the phone
```
