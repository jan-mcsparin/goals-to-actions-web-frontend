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

The app runs on mock data by default. With the switch on, the screens already moved to the API use it instead; for now that's the Aspirations tab and an aspiration's page, and everything else stays on mock. The API repo sits beside this one (`../api`); its README says how to start its database.

```bash
# in ../api
uv run uvicorn app.main:app --reload   # http://localhost:8000

# here
npm run dev:real                       # VITE_API=real; add -- --host for the phone
```

The dev server passes `/api` on to the API, path unchanged, so the phone reaches it through the same address as the app. Set `API_URL` to point it somewhere other than `http://localhost:8000`.

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
