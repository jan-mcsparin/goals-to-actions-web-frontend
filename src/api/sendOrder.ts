// Every write that isn't queued waits for the queue's send under way (ADR-010:
// "online it waits for the queue ahead of it"). The queue says when it's
// sending; request.ts waits on it. A queue that's stuck (a failed send) ends its
// attempt, so other writes then go on their own rather than wait on it.
let sending: Promise<void> = Promise.resolve()

export function queueIsSending(attempt: Promise<void>): void {
  sending = attempt
}

export function afterQueue(): Promise<void> {
  return sending
}
