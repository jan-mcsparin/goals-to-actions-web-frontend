# Implementation Plan: Real by default (#43, part a)

Spec: [`../specs/043a-real-by-default.md`](../specs/043a-real-by-default.md). Issue: [#43](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/43) (part a of four). Tasks: [`todo.md`](todo.md). (The plan for #42 is in git history.)

## Overview

The app talks to the API unless built with `VITE_API=mock`; tests and `npm run dev:mock` use the mock. Settings moves to the API. The Add sheet stops reading the whole Aspirations tab for its pickers.

## Traced: where the repeated reads come from (settled 2)

From the code, in real mode:

- **The Add sheet** calls `getAspirations`, the whole tab's read: aspirations, goals, recurring items and the week (and next week's, from Sunday evening). Its pickers need aspirations and goals only. Opened over the Aspirations tab, it repeats the tab's reads, which is #40's "two or three times".
- Development's StrictMode runs each effect twice; that's not a bug and the build doesn't do it.
- A save on a goal or an aspiration's page reads the page again on purpose (the API's answer is the truth); no screen reads twice on opening.

The browser check (task 4) confirms this with the network log; anything else it finds is fixed there.

## Tasks

1. **Real by default.** `mode.ts`: `VITE_API !== 'mock'`; `test.env` sets mock for every test; `dev:mock` replaces `dev:real`. README, CLAUDE.md and shared decision 23 updated. A test that tests run on the mock. (S)
2. **Settings on the API.** `api/realSettings.ts` (`getSettings`, `setIntensity`) + test; `client.ts` routes both; the real-mode switch test counts the new paths. (S)
3. **The Add sheet reads its choices only.** `getChoices()` (aspirations and goals) in mock and real; `useAdd` calls it; test that opening the sheet reads choices once and never the tab. (S)
4. **Checked in the browser** by a Sonnet agent at phone width against the local API: Settings reads and saves intensity, kept after a reload; the network log on opening Today, Week, Aspirations, an aspiration, a goal, Keep life running, Settings and the Add sheet shows each `GET` once (StrictMode's double aside). Recorded in the spec's Checked section; spec status built. (S)

Checkpoint after each task: `nvm use`, `npm test`, `npm run lint`, `npm run build`.

## Risks

| Risk | Mitigation |
|---|---|
| A test reaches the network once real is the default | `test.env` sets mock; a test asserts `realApi` is false |
| The production build ships mock | the build has no `VITE_API`, so it's real; checked in task 4 by running against the API |
