// The changes made on the plan, kept on the phone and sent in order (ADR-010).
// Check off, uncheck, place, back to the bank, swap and add a task go through
// here; screens show the stored week with `queued()` replayed on top.
//
// Sending: one at a time, the next only after the last is answered. A 404 or a
// 409 drops the change; anything else (no network, a 5xx, a 401, 403 or 422)
// keeps it and stops until the next try: after a new change, on coming back to
// the front, when the network is back, on opening and after signing in.
//
// A confirmed change stays, marked with when it was confirmed, until a week read
// that started after that has landed (`settle`), so the screen never flickers back.
import { addTask, checkOffTask, moveTaskToBank, placeTask, swapTasks, uncheckTask } from './client.ts'
import { NotFoundError, RefusedError } from './errors.ts'
import { queueIsSending } from './sendOrder.ts'
import type { Change } from '../domain/replay.ts'
import { planStore } from '../storage/planStore.ts'

type Entry = { order: number; change: Change; confirmedAt: number | null }

type Listener = () => void

// What screens read, one object per change to the queue, so React can tell when it moved.
export type QueueState = { changes: Change[]; waiting: number; stalled: boolean }

let entries: Entry[] = []
let loading: Promise<void> | undefined
let loaded = false
let sending: Promise<void> | undefined
let stalled = false
let state: QueueState = { changes: [], waiting: 0, stalled: false }
const listeners = new Set<Listener>()
const emptiedListeners = new Set<Listener>()

// Tests: nothing queued, nothing loaded. Listeners stay with their owners.
export function resetQueue(): void {
  entries = []
  loading = undefined
  loaded = false
  sending = undefined
  stalled = false
  state = { changes: [], waiting: 0, stalled: false }
  queueIsSending(Promise.resolve())
}

// Once per session: what the phone kept from last time.
export function loadQueue(): Promise<void> {
  loading ??= planStore()
    .queue.entries()
    .then((kept) => {
      const known = new Set(entries.map((entry) => entry.order))
      const restored = kept.map(([, entry]) => entry as Entry).filter((entry) => !known.has(entry.order))
      entries = [...restored, ...entries].sort((a, b) => a.order - b.order)
      loaded = true
      tell()
    })
    .catch(() => {
      // Nothing kept, or nothing readable: the queue starts empty.
      loaded = true
    })
  return loading
}

// Every change not yet settled, in order: what the screen replays.
export function queued(): Change[] {
  return state.changes
}

// The same, with the count waiting and whether a send failed, as one object that's
// replaced only when something changed (for useSyncExternalStore).
export function queueState(): QueueState {
  return state
}

// Not yet confirmed.
export function waitingCount(): number {
  return entries.filter((entry) => entry.confirmedAt === null).length
}

// A send failed and changes are waiting: Today says so in one quiet line.
export function isStalled(): boolean {
  return stalled && waitingCount() > 0
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The last waiting change has been answered: the week should be read again.
export function onEmptied(listener: Listener): () => void {
  emptiedListeners.add(listener)
  return () => emptiedListeners.delete(listener)
}

// At once once the queue is loaded, so the screen shows the change on the tap
// itself; the first change of a session may wait for what the phone kept.
export function enqueue(change: Change): Promise<void> {
  if (!loaded) return loadQueue().then(() => add(change))
  add(change)
  return Promise.resolve()
}

function add(change: Change) {
  const order = (entries.at(-1)?.order ?? 0) + 1
  const entry: Entry = { order, change, confirmedAt: null }
  entries = [...entries, entry]
  keep(entry)
  tell()
  void flush()
}

// Sends what's waiting, from the first. A second call while sending joins it.
export function flush(): Promise<void> {
  sending ??= sendAll().finally(() => {
    sending = undefined
  })
  queueIsSending(sending)
  return sending
}

// A week read that started at `startedAt` has landed: the changes confirmed
// before then are in it, so they stop being replayed.
export function settle(startedAt: number): void {
  const settled = entries.filter((entry) => entry.confirmedAt !== null && entry.confirmedAt <= startedAt)
  if (settled.length === 0) return
  entries = entries.filter((entry) => !settled.includes(entry))
  for (const entry of settled) forget(entry)
  tell()
}

// Sends again when the app comes back to the front and when the network is back.
// The page and network are the document and window, or stand-ins in tests.
export function installTriggers(
  page: EventTarget & { visibilityState: string } = document,
  network: EventTarget = window,
): () => void {
  const onVisible = () => {
    if (page.visibilityState === 'visible') void flush()
  }
  const onOnline = () => void flush()
  page.addEventListener('visibilitychange', onVisible)
  network.addEventListener('online', onOnline)
  return () => {
    page.removeEventListener('visibilitychange', onVisible)
    network.removeEventListener('online', onOnline)
  }
}

async function sendAll(): Promise<void> {
  await loadQueue()
  let sent = false
  for (;;) {
    const next = entries.find((entry) => entry.confirmedAt === null)
    if (!next) break
    try {
      await send(next.change)
      stalled = false
      confirm(next)
      sent = true
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof RefusedError) {
        stalled = false
        drop(next)
        sent = true
        continue
      }
      stalled = true
      tell()
      return
    }
  }
  if (sent) for (const listener of emptiedListeners) listener()
}

function send(change: Change): Promise<unknown> {
  switch (change.kind) {
    case 'checkOff':
      return checkOffTask(change.taskId, change.checkOff)
    case 'uncheck':
      return uncheckTask(change.taskId)
    case 'place':
      return placeTask(change.taskId, change.week, change.day)
    case 'toBank':
      return moveTaskToBank(change.taskId, change.week)
    case 'swap':
      return swapTasks(change.taskId, { week: change.week, bankTaskId: change.bankTaskId, day: change.day })
    case 'addTask':
      return addTask(change.task, change.taskId)
  }
}

function confirm(entry: Entry) {
  const confirmed = { ...entry, confirmedAt: Date.now() }
  entries = entries.map((candidate) => (candidate === entry ? confirmed : candidate))
  keep(confirmed)
  tell()
}

function drop(entry: Entry) {
  entries = entries.filter((candidate) => candidate !== entry)
  forget(entry)
  tell()
}

// The phone's copy follows; if it can't be written, the queue still works for the session.
function keep(entry: Entry) {
  planStore()
    .queue.put(entry.order, entry)
    .catch(() => {})
}

function forget(entry: Entry) {
  planStore()
    .queue.delete(entry.order)
    .catch(() => {})
}

function tell() {
  state = { changes: entries.map((entry) => entry.change), waiting: waitingCount(), stalled: isStalled() }
  for (const listener of listeners) listener()
}
