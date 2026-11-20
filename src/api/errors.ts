// A record that isn't there (the API's 404), so a screen can tell it apart
// from a failed request.
export class NotFoundError extends Error {
  name = 'NotFoundError'
}

// The API's 401: no live session on this device. Never a refusal of the
// change itself (ADR-012); the app asks for the passkey instead.
export class SignedOutError extends Error {
  name = 'SignedOutError'
}
