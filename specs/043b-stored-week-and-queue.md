# Spec: The stored week and the queue (#43, part b)

Status: draft 2026-11-20. Part b of [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43): a [real by default](043a-real-by-default.md) → **b stored week and queue** → c [other screens offline](043c-other-screens-offline.md) → d [sign-in around the queue](043d-sign-in-around-the-queue.md). Depends on part a. The design is [ADR-010](../../docs/adr/0010-week-document-and-replayed-queue.md); the API's side is shared decisions 13 to 15 in [its map](../../api/specs/README.md). This is the part ADR-004's promise rests on, and the riskiest.

## Objective

Today opens from the week stored on the phone, a check-off shows at once and stays, and changes made offline send when the connection is back. Nothing typed or tapped is lost to a dropped connection.

### What exists afterwards

1. **The week is stored as it arrived.** Each week read is kept on the phone, one document per open week (keyed by its Monday), never edited there. Today, any day, the bank and Week draw from it first, then a fresh read replaces it.
2. **A queue of changes,** kept on the phone, in order, each a complete request: check off, uncheck, place on a day, back to the bank, swap and add a task. (Still matter? answers, wrap-up and everything else need a connection: ADR-010's list.)
3. **The screen is the stored week with the queue replayed on top.** One replay rule per kind of change, plain functions in `domain/` (`placedOnDay`, `inTheBank`, `checkedOff` and `uncheckedOff` already exist, plus swap and add). A rule does nothing when its task isn't in the document.
4. **Sending:** one at a time, in order, the next only after the last is answered. It starts when the app opens or comes back to the front, when the network comes back, after each new change, and after signing in.
   - Success: the change leaves the queue, but keeps being replayed until a week read that started after it was confirmed arrives, so the screen never flickers back.
   - 404 or 409: dropped, no message; it stops being replayed.
   - Anything else (no network, a timeout, a 5xx, 401, 403, 422): it stays, sending stops until the next trigger.
   - The queue empty again: the week is read again.
5. **One quiet line on Today** while changes wait after a failed send: "3 changes waiting to send" ("1 change waiting to send"). No other message for a queued change. A tap no longer goes back on a failed save.
6. **Every other write waits its turn.** Online, it's sent once the queue ahead of it is empty; offline it fails with "Couldn't save that. Try again." as now.
7. **A day never fetched still opens** from its week's document, and offline Today shows the stored current week (or next week's, once that has become current: ADR-010's Monday case).
8. **The phone asks to keep its storage** (`navigator.storage.persist()`), once, quietly.

### Accepted until later

- Other screens (Aspirations, an aspiration, a goal, Keep life running, Settings) still read live and don't open offline (part c). Their counts don't include unsent changes (ADR-010).
- A 401 still shows the sign-in page in place of the app; the queue stays and is sent after signing in. The sheet and banner are part d.
- Phone checks of iOS keeping the data are with #8, once hosted.

## Scope

**In:**

- `src/storage/`: an IndexedDB store (one database, a store for week documents and one for the queue) behind a small interface, with an in-memory version for tests (decision 1).
- `src/api/queue.ts` (or `sync/`): enqueue, the sender, the triggers (`visibilitychange`, `online`, a new change, sign-in), the answers' rules, waiting for an empty queue before any other write.
- `src/domain/replay.ts`: `replay(week, changes)` and a rule per kind; the swap and add rules are new.
- `src/hooks/useDay.ts`, `useWeek.ts`: show stored + replayed, refresh in the background, enqueue in place of save-and-revert. `useAdd.ts`: a new task is queued; the confirmation reads the replayed placement.
- Today's quiet line (`Day.tsx` and a small component).
- `useSession`'s marked spot: send the queue after signing in.
- Docs: `CLAUDE.md` (storage), ADR-010 "Built" line, `docs/flows.md` wherever a failed save is described for these actions.

**Out:**

- Other screens' stored responses (part c); session-ended sheet and banner, sign-out clearing (part d).
- The quitting goal's writes (#37 adds them as kinds).
- Background sync (none on iOS).

## Commands

As part a (`nvm use`, `npm test`, `npm run lint`, `npm run build`, `npm run dev`).

## Project structure

```
src/storage/planStore.ts      IndexedDB: week documents and the queue (+ memory version for tests)
src/api/queue.ts              enqueue, send in order, the answers' rules, triggers
src/domain/replay.ts          replay(week, changes) and one rule per kind
src/components/Waiting.tsx    "3 changes waiting to send"
```

## Code style

As spec 042. A replay rule is a plain function over the document:

```ts
// A queued change, as stored: the request it sends and what it does to the week.
export type Change =
  | { kind: 'checkOff'; id: string; taskId: string; checkOff: CheckOff }
  | { kind: 'uncheck'; id: string; taskId: string }
  | { kind: 'place'; id: string; taskId: string; week: string; day: string }
  | { kind: 'toBank'; id: string; taskId: string; week: string }
  | { kind: 'swap'; id: string; taskId: string; week: string; bankTaskId: string; day: string }
  | { kind: 'addTask'; id: string; task: NewTask & { id: string } }

export function replay(week: Week, changes: Change[]): Week {
  return changes.reduce(applyChange, week)
}
```

## Testing strategy

- **`domain/replay.test.ts`:** each rule on a `Week` fixture; a rule for a task not in the week changes nothing; order matters (check off then uncheck).
- **`api/queue.test.ts`** on the memory store and a stubbed `fetch`: sends in order, one at a time; 200 removes, 404 and 409 drop, 500, 401, 422 and a network failure keep and stop; a confirmed change stays replayed until a later read; the week is read once the queue empties; another write waits for the queue; offline it fails.
- **Hooks:** `useDay` shows the stored week before the read lands; a check-off shows at once and doesn't go back on a failure; the quiet line counts. Existing revert tests change to "stays and waits".
- **Manual, by a Sonnet agent at phone width against the local API**, with DevTools' offline switch: open Today, go offline, check off, place, swap and add a task; reload offline (Today opens with the changes); online again, they send in order and the screen doesn't flicker; a change made moot (task deleted on the server) disappears quietly; the API stopped mid-queue: the quiet line shows, and restarting it sends the rest.

## Boundaries

- **Always:** the stored document is never edited; replay rules live in `domain/` with no React; every storage call can fail without breaking the screen (private mode, a full disk): the app then works as part a did.
- **Ask first:** any dependency (decision 1); queueing a kind ADR-010 doesn't list; any API change.
- **Never:** drop a change on anything but 404 or 409; send two queued changes at once; show a failed-save message for a queued change.

## Success criteria

- [ ] Today, a day, the bank and Week open from the stored week, then refresh.
- [ ] The six changes show at once, are kept on the phone, and send in order with ADR-010's rules for each answer.
- [ ] A confirmed change never flickers back; a dropped one disappears quietly.
- [ ] "N changes waiting to send" shows while changes wait after a failed send, and only then.
- [ ] Other writes wait for the queue, and fail offline as before.
- [ ] Offline, Today opens on a day never fetched, from its week.
- [ ] Persistent storage is asked for.
- [ ] Tests and docs updated.

## Open questions

1. **A library for IndexedDB?** Recommended: none. A small wrapper over IndexedDB in `storage/` (two stores, get/put/delete/list), and a memory version with the same interface for unit tests; the real one is proved in the browser checks. The alternative is `fake-indexeddb` as a dev-only dependency so the real wrapper runs in Vitest too.
2. **How does an added task replay before the server answers?** Recommended: on its day when it was added to one in a stored week; otherwise in the current week's bank, or a stored later week's bank when its due date falls there; not shown on the plan when due beyond the stored weeks (the confirmation says "Saved. It joins the week it's due."). That's a guess of the server's placement for display only, replaced by the server's answer; the server still decides (ADR-008).
3. **What does the line say for a 422?** ADR-010 says the quiet line says so. Recommended: the same "N changes waiting to send"; a 422 is a bug to fix, not something the person can act on.
4. **Is Week's "Wrap up" held while changes wait?** Recommended: it waits for the queue like any other write (item 6), so the wrap-up sees every check-off first.
