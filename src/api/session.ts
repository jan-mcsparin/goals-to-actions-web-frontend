// Who wants to know that this device has been signed out. request.ts calls
// signedOut() on a 401; useSession listens. There's no "who am I" route: the
// app starts signed in, and the first 401 says otherwise.
//
// Sign-ins are counted, so a 401 for a request sent before the latest sign-in
// (its reply arriving late) doesn't sign the device out again.
type Listener = () => void

const listeners = new Set<Listener>()
let count = 0

export function onSignedOut(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// How many times this device has signed in since the app opened. request.ts
// notes it when it sends.
export function signIns(): number {
  return count
}

export function signedIn(): void {
  count += 1
}

// `sentAt`: signIns() when the refused request was sent.
export function signedOut(sentAt = count): void {
  if (sentAt !== count) return
  for (const listener of listeners) listener()
}
