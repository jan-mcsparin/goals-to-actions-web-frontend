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
