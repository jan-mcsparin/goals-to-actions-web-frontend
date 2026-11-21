// What the session-ended sheet, the banner and the sign-out warning say about
// the changes on the phone not yet sent (ADR-012).

function changes(count: number): string {
  return count === 1 ? '1 change' : `${count} changes`
}

// The session-ended sheet: with nothing waiting, the count is left out.
export function safeLine(waiting: number): string {
  const safe = 'Everything you did is safe on this phone'
  if (waiting === 0) return `${safe}.`
  return `${safe}: ${changes(waiting)} will send as soon as you're back in.`
}

// The banner after Not now.
export function bannerLine(waiting: number): string {
  if (waiting === 0) return 'Not signed in'
  return `Not signed in · ${changes(waiting)} waiting`
}

// The sign-out sheet, when sending first left some behind.
export function unsentLine(unsent: number): string {
  return `${changes(unsent)} ${unsent === 1 ? "hasn't" : "haven't"} been sent yet.`
}
