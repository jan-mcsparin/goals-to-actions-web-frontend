// Ids made on the device, so a create can be sent again without making a
// second row (the API's PUT /things/{id}). A version 4 UUID built from
// crypto.getRandomValues, because browsers leave crypto.randomUUID out on
// plain-http pages such as the dev server opened from a phone.
export function newDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
