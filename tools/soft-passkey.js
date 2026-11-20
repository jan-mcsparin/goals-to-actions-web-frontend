// A software passkey, so a browser driven by an agent (or a test) can sign in
// to the app on localhost without a person at Touch ID. Development only.
//
// Run it in the page before signing in, e.g. with the Chrome DevTools MCP's
// evaluate_script (`sourcePath` set to this file, `format: "script"`). It
// replaces navigator.credentials.create and .get in that tab only, until the
// page reloads. The sign-in steps are otherwise the real ones: a one-time code
// from the API's `code` command adds this passkey, and the API checks its
// signatures with its WebAuthn library as it would a phone's.
//
// What keeps it harmless (it lives in a public repo):
// - It isn't part of the app: not under src/ or public/, so it's never built,
//   served or cached by the service worker.
// - It refuses to run anywhere but http://localhost.
// - It holds no secret. Its key is made in the browser when a passkey is
//   added, and kept in that browser's localStorage for localhost.
// - It gives no way in that a code doesn't already give: adding any passkey
//   needs a one-time code, made by a command with access to the database.
//
// The passkey is ES256 (P-256), with "none" attestation, user verification
// claimed, a sign count of 0, and discoverable (sign-in names no user).
// window.softPasskey.forget() removes the kept keys.
;(() => {
  'use strict'

  if (location.protocol !== 'http:' || location.hostname !== 'localhost') {
    throw new Error('soft-passkey: development only; runs on http://localhost and nowhere else')
  }
  if (window.softPasskey) return

  const STORAGE_KEY = 'soft-passkey'
  const ES256 = -7
  const FLAG_USER_PRESENT = 0x01
  const FLAG_USER_VERIFIED = 0x04
  const FLAG_ATTESTED_DATA = 0x40
  const encoder = new TextEncoder()

  // --- bytes ---------------------------------------------------------------

  function bytesOf(source) {
    if (source instanceof ArrayBuffer) return new Uint8Array(source)
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
  }

  function concat(...parts) {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
    let at = 0
    for (const part of parts) {
      out.set(part, at)
      at += part.length
    }
    return out
  }

  function toBase64url(bytes) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async function sha256(bytes) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  }

  function uint32(value) {
    return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])
  }

  // --- CBOR, just what attestation needs: ints, bytes, text and maps --------

  function cborHead(major, length) {
    const type = major << 5
    if (length < 24) return new Uint8Array([type | length])
    if (length < 256) return new Uint8Array([type | 24, length])
    if (length < 65536) return new Uint8Array([type | 25, length >> 8, length & 255])
    return concat(new Uint8Array([type | 26]), uint32(length))
  }

  function cbor(value) {
    if (typeof value === 'number') return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
    if (typeof value === 'string') {
      const text = encoder.encode(value)
      return concat(cborHead(3, text.length), text)
    }
    if (value instanceof Uint8Array) return concat(cborHead(2, value.length), value)
    if (value instanceof Map) {
      const parts = [cborHead(5, value.size)]
      for (const [key, entry] of value) parts.push(cbor(key), cbor(entry))
      return concat(...parts)
    }
    throw new Error('soft-passkey: no CBOR for that value')
  }

  // WebCrypto signs as r‖s; WebAuthn wants an ASN.1 DER sequence of two integers.
  function derSignature(raw) {
    const integer = (half) => {
      let start = 0
      while (start < half.length - 1 && half[start] === 0) start += 1
      const trimmed = half.slice(start)
      const body = trimmed[0] & 0x80 ? concat(new Uint8Array([0]), trimmed) : trimmed
      return concat(new Uint8Array([0x02, body.length]), body)
    }
    const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)))
    return concat(new Uint8Array([0x30, body.length]), body)
  }

  // --- the kept passkeys -----------------------------------------------------

  function kept() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return []
    }
  }

  function keep(passkeys) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passkeys))
  }

  // --- the two calls ---------------------------------------------------------

  function refused(name, message) {
    return Promise.reject(new DOMException(`soft-passkey: ${message}`, name))
  }

  function clientData(type, challenge) {
    const json = JSON.stringify({ type, challenge: toBase64url(bytesOf(challenge)), origin: location.origin, crossOrigin: false })
    return encoder.encode(json)
  }

  function credential(id, response) {
    const json = {
      id,
      rawId: id,
      type: 'public-key',
      response,
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    }
    return { id, type: 'public-key', authenticatorAttachment: 'platform', toJSON: () => json }
  }

  async function create(options) {
    const rpId = options.rp.id ?? location.hostname
    if (!options.pubKeyCredParams.some((param) => param.alg === ES256)) {
      return refused('NotSupportedError', 'only ES256')
    }
    const excluded = new Set((options.excludeCredentials ?? []).map((item) => toBase64url(bytesOf(item.id))))
    if (kept().some((passkey) => passkey.rpId === rpId && excluded.has(passkey.id))) {
      return refused('InvalidStateError', 'a passkey for this account is already here')
    }

    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const point = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))
    const coseKey = cbor(
      new Map([
        [1, 2], // kty: EC2
        [3, ES256], // alg
        [-1, 1], // crv: P-256
        [-2, point.slice(1, 33)], // x
        [-3, point.slice(33, 65)], // y
      ]),
    )
    const idBytes = crypto.getRandomValues(new Uint8Array(16))
    const authData = concat(
      await sha256(encoder.encode(rpId)),
      new Uint8Array([FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_DATA]),
      uint32(0),
      new Uint8Array(16), // AAGUID: none
      new Uint8Array([idBytes.length >> 8, idBytes.length & 255]),
      idBytes,
      coseKey,
    )
    const attestationObject = cbor(
      new Map([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    )

    const id = toBase64url(idBytes)
    keep([
      ...kept(),
      {
        id,
        rpId,
        userHandle: toBase64url(bytesOf(options.user.id)),
        privateKey: await crypto.subtle.exportKey('jwk', keys.privateKey),
      },
    ])
    return credential(id, {
      clientDataJSON: toBase64url(clientData('webauthn.create', options.challenge)),
      attestationObject: toBase64url(attestationObject),
      transports: ['internal'],
    })
  }

  async function get(options) {
    const rpId = options.rpId ?? location.hostname
    const allowed = new Set((options.allowCredentials ?? []).map((item) => toBase64url(bytesOf(item.id))))
    const candidates = kept().filter((passkey) => passkey.rpId === rpId && (allowed.size === 0 || allowed.has(passkey.id)))
    // The newest, as a phone offers the last one used. None: as if the person closed the sheet.
    const passkey = candidates.at(-1)
    if (!passkey) return refused('NotAllowedError', 'no passkey kept for this site')

    const privateKey = await crypto.subtle.importKey('jwk', passkey.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'sign',
    ])
    const authenticatorData = concat(
      await sha256(encoder.encode(rpId)),
      new Uint8Array([FLAG_USER_PRESENT | FLAG_USER_VERIFIED]),
      uint32(0),
    )
    const clientDataJSON = clientData('webauthn.get', options.challenge)
    const signed = concat(authenticatorData, await sha256(clientDataJSON))
    const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signed))

    return credential(passkey.id, {
      clientDataJSON: toBase64url(clientDataJSON),
      authenticatorData: toBase64url(authenticatorData),
      signature: toBase64url(derSignature(raw)),
      userHandle: passkey.userHandle,
    })
  }

  navigator.credentials.create = (request) =>
    request?.publicKey ? create(request.publicKey) : refused('NotSupportedError', 'passkeys only')
  navigator.credentials.get = (request) =>
    request?.publicKey ? get(request.publicKey) : refused('NotSupportedError', 'passkeys only')

  window.softPasskey = {
    forget: () => localStorage.removeItem(STORAGE_KEY),
    count: () => kept().length,
  }
})()
