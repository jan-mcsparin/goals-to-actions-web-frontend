# Implementation Plan: The stored week and the queue (#43, part b)

Spec: [`../specs/043b-stored-week-and-queue.md`](../specs/043b-stored-week-and-queue.md). Issue: [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43) (part b of four). Tasks: [`todo.md`](todo.md). Design: ADR-010. (The plan for 043a is in git history.)

## Overview

The week read is stored on the phone as it arrived, the six plan changes go into a queue kept on the phone, and screens show the stored week with the queue replayed on top. The queue sends one change at a time, in order, on open, on coming back to the front, on the network coming back, after each new change and after signing in.

## Architecture decisions

- **Storage** (`storage/planStore.ts`): one IndexedDB database with a `weeks` store (key: Monday) and a `queue` store (key: order number). The same interface has a memory version, used wherever there's no IndexedDB (jsdom and Node in tests), so tests need no setup beyond a reset. `navigator.storage.persist()` is asked once, on the first write. Any storage failure falls back to memory for the session: the app then works as 043a did.
- **Refusals are typed.** `request.ts` throws `RefusedError` on 409 (as `NotFoundError` on 404); the mock throws it where the API would answer 409 (a plan edit in the wrong week, a past day, a task not planned or not in the bank, a check-off in a week not started, unchecking one not done). Only these two drop a change.
- **Replay rules** (`domain/replay.ts`): `replay(week, changes)` folds one rule per kind over the document. Add builds a task from `NewTask` and puts it where we expect the server to (settled 2): `predictedPlace(newTask, weeks, today)`.
- **The queue** (`api/queue.ts`): `enqueue(change)`, `flush()`, `subscribe(listener)`, `queued()` (waiting and confirmed changes), `stalled` (a send failed and changes wait). A confirmed change stays, marked with when it was confirmed, until a week read that started after that lands (`settle(startedAt)`). `addTask` takes its id from the change, so a resend is the same PUT.
- **Other writes wait their turn** (`api/sendOrder.ts`): `request.ts` waits for the send in progress before any write that isn't the queue's own (sign-in routes excepted). If the queue is stuck after that attempt (a failure), the write goes anyway and succeeds or fails on its own, so a stuck change never blocks Settings or a goal. Offline it fails as now.
- **One hook for the plan** (`hooks/useStoredWeek.ts`): for a Monday (Today and a day) or "current and next" (Week): the stored document first, then the fresh read (stored, and settling confirmed changes), with the queue replayed on top; reads again on the data revision and when the queue empties. `useDay` and `useWeek` use it in place of `useLoaded`.
- **Still matter? and wrap-up stay online** (ADR-010). Still matter? hides its card at once and reads the week again after the answer; it comes back if the save fails, as now. Wrap-up stores the week it gets back.

## Tasks

1. **Refusals are typed.** `RefusedError`; `request.ts` throws it on 409; the mock's refusals of the six queueable writes throw it. Tests. (S)
2. **The store.** `storage/planStore.ts`: IndexedDB with a memory fallback, two stores, `persist()` once, reset for tests. Tests on the memory version. (S)
3. **Replay rules.** `domain/replay.ts`: the `Change` type, a rule per kind (swap and add new), `predictedPlace`. Tests on `Week` fixtures. (M)
4. **The queue.** `api/queue.ts` and `api/sendOrder.ts`: enqueue, send in order, the answers' rules, confirmed-until-read, stalled, subscribe, the triggers (`visibilitychange`, `online`); `request.ts` waits its turn; `addTask` takes an id (mock and real). Tests with stubbed client functions. (M)
5. **The stored week hook.** `hooks/useStoredWeek.ts`: stored first, fresh after, settle, replay, reload on revision and on the queue emptying. Tests. (M)
6. **Today and a day on the queue.** `useDay`: check off, uncheck, pull, back to bank and swap enqueue; Still matter? as above. Tests change from "goes back" to "stays and waits". (M)
7. **Week on the queue.** `useWeek`: place enqueues; wrap-up stores its answer. Tests. (S)
8. **Add a task on the queue.** `useAdd`: a task is queued with its id; the confirmation reads `predictedPlace`. Tests. (S)
9. **The quiet line and the triggers.** "N changes waiting to send" on Today while the queue is stalled; App sends on open and after signing in (`useSession`'s marked spot). Tests. (S)
10. **Docs and the browser check.** CLAUDE.md (storage), ADR-010 built line, `docs/flows.md` where failed saves are described; a Sonnet agent checks offline at phone width against the local API; spec Checked and built. (S)

Checkpoints: `nvm use`, `npm test`, `npm run lint`, `npm run build` after each task; the app keeps working after each (tasks 1–5 add pieces nothing uses yet; 6–9 switch the screens over one at a time).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The queue's module state leaks between tests | Flaky tests | A reset (queue and store) in `src/test/setup.ts` and in each node test file that uses them |
| A change stuck forever (a 422) holds back the ones behind it | Changes wait | Expected (ADR-010); the quiet line shows; other writes still go (decision above) |
| IndexedDB only tested in the browser (settled 1) | A storage bug unseen by unit tests | The browser check reloads offline and reads IndexedDB |
| The added task's predicted place differs from the server's | It moves once sent | Display only, replaced by the server's answer (settled 2) |
