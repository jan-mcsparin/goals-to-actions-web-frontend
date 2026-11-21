// What the phone keeps of the plan (ADR-010): each week read as it arrived, by
// its Monday, and the queue of changes not yet confirmed, by their order. In
// IndexedDB where there is one, in memory where there's none (as in tests).
// Where IndexedDB is there but won't open (an old Safari private window), every
// call fails instead. So every call can fail: callers keep their own state and
// treat the store as a copy, and the app works for the session without it.
import type { Week } from '../api/types.ts'

export type Shelf<K extends IDBValidKey, V> = {
  get(key: K): Promise<V | undefined>
  put(key: K, value: V): Promise<void>
  delete(key: K): Promise<void>
  // In key order.
  entries(): Promise<[K, V][]>
  clear(): Promise<void>
}

export type PlanStore = {
  weeks: Shelf<string, Week>
  // What each entry holds is the queue's business (api/queue.ts).
  queue: Shelf<number, unknown>
  clear(): Promise<void>
}

const DATABASE = 'gta-plan'
const SHELVES = ['weeks', 'queue'] as const

let current: PlanStore | undefined
let askedToPersist = false

export function planStore(): PlanStore {
  current ??= typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore()
  return current
}

// Tests: a fresh, empty store.
export function resetPlanStore(): void {
  current = undefined
  askedToPersist = false
}

// Asked once, quietly, the first time anything is kept: iOS may otherwise clear
// an installed app's data after a while unused.
function askToPersist() {
  if (askedToPersist) return
  askedToPersist = true
  try {
    navigator.storage?.persist?.().catch(() => {})
  } catch {
    // Nothing to ask with.
  }
}

function store(weeks: Shelf<string, Week>, queue: Shelf<number, unknown>): PlanStore {
  return {
    weeks,
    queue,
    clear: async () => {
      await Promise.all([weeks.clear(), queue.clear()])
    },
  }
}

function memoryStore(): PlanStore {
  return store(memoryShelf(), memoryShelf())
}

function memoryShelf<K extends string | number, V>(): Shelf<K, V> {
  const values = new Map<K, V>()
  return {
    get: async (key) => (values.has(key) ? structuredClone(values.get(key)) : undefined),
    put: async (key, value) => {
      askToPersist()
      values.set(key, structuredClone(value))
    },
    delete: async (key) => {
      values.delete(key)
    },
    entries: async () =>
      [...values.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => [key, structuredClone(value)]),
    clear: async () => values.clear(),
  }
}

function indexedDbStore(): PlanStore {
  const opened = openDatabase()
  return store(indexedDbShelf(opened, 'weeks'), indexedDbShelf(opened, 'queue'))
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)
    opening.onupgradeneeded = () => {
      for (const name of SHELVES) {
        if (!opening.result.objectStoreNames.contains(name)) opening.result.createObjectStore(name)
      }
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error)
  })
}

function indexedDbShelf<K extends IDBValidKey, V>(opened: Promise<IDBDatabase>, name: (typeof SHELVES)[number]): Shelf<K, V> {
  async function run<T>(mode: IDBTransactionMode, work: (shelf: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await opened
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(name, mode)
      const asked = work(transaction.objectStore(name))
      transaction.oncomplete = () => resolve(asked.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }

  return {
    get: (key) => run('readonly', (shelf) => shelf.get(key) as IDBRequest<V | undefined>),
    put: async (key, value) => {
      askToPersist()
      await run('readwrite', (shelf) => shelf.put(value, key))
    },
    delete: async (key) => {
      await run('readwrite', (shelf) => shelf.delete(key))
    },
    // One cursor, in key order, so keys and values come from the same moment.
    entries: async () => {
      const database = await opened
      return new Promise((resolve, reject) => {
        const found: [K, V][] = []
        const transaction = database.transaction(name, 'readonly')
        const cursor = transaction.objectStore(name).openCursor()
        cursor.onsuccess = () => {
          if (!cursor.result) return
          found.push([cursor.result.key as K, cursor.result.value as V])
          cursor.result.continue()
        }
        transaction.oncomplete = () => resolve(found)
        transaction.onerror = () => reject(transaction.error)
      })
    },
    clear: async () => {
      await run('readwrite', (shelf) => shelf.clear())
    },
  }
}
