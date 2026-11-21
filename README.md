# goals-to-actions-web-frontend

Front end for Goals to Actions: a React + Vite + TypeScript installable PWA. Product docs live in the parent repo (`../docs/`); see `CLAUDE.md` for structure and rules.

## Install

```bash
nvm use        # Node version from .nvmrc
npm install
```

## Develop

```bash
npm run dev    # local dev server
npm run lint   # oxlint
```

To try it on an iPhone, run `npm run dev -- --host` and open the network URL on the same Wi-Fi.

## Run against a local API

The app runs on the API: `npm run dev` and every build talk to it. The mock data is for the click-through (`npm run dev:mock`, no API needed) and for the tests, which always run on it. The API repo sits beside this one (`../api`); its README says how to start its database.

```bash
# in ../api
uv run uvicorn app.main:app --reload   # http://localhost:8000

# here
npm run dev                            # add -- --host for the phone
```

The dev server passes `/api` on to the API, path unchanged, so the phone reaches it through the same address as the app. Set `API_URL` to point it somewhere other than `http://localhost:8000`.

### Signing in without a person (agents and tests)

Signed in, the app needs a passkey, and a browser driven by an agent has no Touch ID. `tools/soft-passkey.js` is a software passkey for that: run it in the page, and `navigator.credentials` in that tab answers with a key made in the browser. Everything else is the real sign-in, checked by the API's WebAuthn library. It runs only on `http://localhost`, isn't part of the build, and holds no secret: adding its passkey still needs a one-time code.

1. With the API and `npm run dev` running, open `http://localhost:5173`. Signed out, the sign-in page shows as soon as a screen on the API gets a 401, which Today does on opening.
2. Run the script in the page. With the Chrome DevTools MCP, that's `evaluate_script` with `sourcePath` set to this file and `format: "script"`. Do it again after each reload, before signing in.
3. The first time in that browser, make a code (in `../api`: `uv run python -m app.sign_in.command code <user-id>`; the founder's account is `00000000-0000-4000-8000-000000000001`). Then **New device? Use a one-time code**, the code, Continue, and **Add passkey**.
4. After that, **Sign in with Face ID** signs in with the kept key. `window.softPasskey.forget()` removes it.

After each API change, regenerate the types from the API's committed schema and commit the result:

```bash
npm run api:types   # ../api/openapi.json → src/api/openapi.ts
```

The generator runs from `tools/api-types/`, with its own TypeScript 5.9: openapi-typescript needs TypeScript's JS API, which TypeScript 7.0 doesn't ship.

## Build

```bash
npm run build    # type-check and build into dist/ (includes the service worker)
npm run preview  # serve the production build locally
```

## Test

```bash
npm test         # Vitest, single run
npm run test:watch
```
