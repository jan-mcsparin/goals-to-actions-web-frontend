// Who wants to know that this device has been signed out. request.ts calls
// signedOut() on a 401; useSession listens. There's no "who am I" route: the
// app starts signed in, and the first 401 says otherwise.
type Listener = () => void

const listeners = new Set<Listener>()

export function onSignedOut(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function signedOut(): void {
  for (const listener of listeners) listener()
}
