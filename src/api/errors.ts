// A record that isn't there (the API's 404), so a screen can tell it apart
// from a failed request.
export class NotFoundError extends Error {
  name = 'NotFoundError'
}
