// A number App raises after something is added, so the open screen loads
// again. useLoaded (which the screens' load hooks use) reloads on it and keeps
// showing what it has meanwhile. It's 0 without a provider.
import { createContext, useCallback, useContext, useState } from 'react'

export const DataRevision = createContext(0)

export function useDataRevision(): number {
  return useContext(DataRevision)
}

// For App: the revision to provide, and a way to raise it.
export function useRevisionCounter(): { revision: number; bump: () => void } {
  const [revision, setRevision] = useState(0)
  const bump = useCallback(() => setRevision((previous) => previous + 1), [])
  return { revision, bump }
}
