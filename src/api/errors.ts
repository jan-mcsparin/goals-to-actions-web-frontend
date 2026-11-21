// A record that isn't there (the API's 404), so a screen can tell it apart
// from a failed request.
export class NotFoundError extends Error {
  name = 'NotFoundError'
}

// The API's 409: the rules don't allow the change, or it no longer applies (a
// task that has moved on to another week). A queued change refused so is dropped.
export class RefusedError extends Error {
  name = 'RefusedError'
}

// The API's 401: no live session on this device. Never a refusal of the
// change itself (ADR-012); the app asks for the passkey instead.
export class SignedOutError extends Error {
  name = 'SignedOutError'
}
