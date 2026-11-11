# Spec: Installable and opens instantly on iPhone (#8)

Status: draft 2026-11-10, awaiting approval. Built last, after every screen; hosting is chosen then. Issue: [#8](https://github.com/jan-mcsparin/goals-to-actions-web-frontend/issues/8). Module `install-instant-open` in the [map](README.md). Depends on #4–#7 and the [aspiration page](013-aspiration-page.md).

## Objective

The app installs to the iPhone home screen and opens straight to where the person left off, without waiting on the network. This is ADR-004's promise for the click-through: the shell and the remembered screen. The stored plan and the offline queue follow as their own issue once there's an API to sync with.

Much of this is already in place from #1–#3, so this spec is mostly about proving it on a real iPhone and closing the gaps that shows.

References: [ADR-001](../../docs/adr/0001-pwa.md), [ADR-004](../../docs/adr/0004-instant-open.md).

### Already there

- Web app manifest from `vite.config.ts`: name from `APP_NAME`, standalone display, theme colour, 192 and 512 px icons, a 180 px `apple-touch-icon`.
- A service worker from vite-plugin-pwa that precaches every built file.
- iOS meta tags in `index.html` and `viewport-fit=cover`.
- The open screen (`gta.screen`), Today's List / By goal choice (`gta.todayView`) and each goal's Show all / Show less (`gta.timelineExpanded`) kept in `localStorage`.
- Sheets follow the visual viewport so they sit above the keyboard (`useModalDialog`), checked only in a Safari tab so far.

None of it has been checked on a phone from an installed copy.

### What the person gets

1. **Install:** Safari's Share → Add to Home Screen offers the app's name and its icon. Opened from the home screen it runs standalone: no Safari bars, content clear of the notch and the home indicator, in light and dark.
2. **Opens offline:** in airplane mode, a cold start shows the app, on the remembered screen, with no error and no blank page.
3. **Comes back where it was:** after iOS closes the app in the background, or the person swipes it away, it reopens on the same screen: Today, Week, an opened day, Aspirations, an opened aspiration, Keep life running, an opened goal or Settings. Today's List / By goal choice and each goal's Show all / Show less are kept too.
4. **Knows what day it is:** if the app was left open overnight, coming back to it shows the new day as Today. (Today is worked out once at launch now, so it would still show yesterday.)
5. **Updates quietly:** a new version is picked up without the person doing anything, never reloads the page while they're using it, and is running by the next time the app is opened. No "update available" prompt.

## Scope

**In:**
- An audit on the phone of items 1–3, and fixes for what it finds. Likely candidates: the maskable icon (it reuses the plain 512 px icon, which may be cropped), the status-bar style in standalone, safe-area gaps on the new screens.
- The current day refreshes when the app returns to the foreground on a new date (`hooks/useToday.ts`, used by `App.tsx`).
- Update behaviour as in item 5. How to get it from vite-plugin-pwa is settled in the plan, against its documentation.
- Every `Screen` added since #3 restores, and a remembered screen that no longer makes sense falls back safely.
- Somewhere to load the built app over HTTPS on the phone (see Open questions).
- Docs: README (how to try the installed app on a phone); ADR-004 gets a line on what's done and what's deferred.

**Out (own issue, needs the API):**
- The last-known plan in IndexedDB, rendered first and refreshed after.
- The offline queue for check-offs and its flush on open.
- Push notifications, Android checks, a custom install prompt, splash-screen images.

## Commands

```bash
nvm use
npm test
npm run lint
npm run build
npm run preview -- --host   # the production build, with the service worker
```

A service worker only registers over HTTPS (or on localhost), so `npm run dev -- --host` over Wi-Fi can't show offline behaviour on the phone. Plain http also hides other browser features altogether (`crypto.randomUUID()` was one, and broke saving), so the phone checks need the built app on an HTTPS address.

## Code style

As in the [shared conventions](README.md#shared-conventions). The product name stays in `src/config.ts` only.

```ts
// hooks/useToday.ts
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDay(new Date()))

  useEffect(() => {
    const refresh = () => setToday(toLocalDay(new Date()))
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  return today
}
```

## Testing strategy

- **`hooks/useToday.test.tsx`:** the day changes after the clock passes midnight and the page becomes visible; it doesn't re-render when the date is the same.
- **`storage/navigation.test.ts`:** every screen in the union round-trips; unknown or damaged values fall back to Today (extends the existing tests).
- **`App.test.tsx`:** each screen survives a remount.
- **Build check (by hand, after `npm run build`):** `dist/manifest.webmanifest` has the name, `display: standalone`, `start_url` and the three icons; the service worker's precache list includes `index.html`, the JS, the CSS and the icons.
- **On a real iPhone, from the home-screen icon** (the checklist goes in the PR, ticked):
  - [ ] Add to Home Screen shows the right name and icon.
  - [ ] Opens standalone; header and tab bar clear the notch and the home indicator; light and dark.
  - [ ] Airplane mode, app swiped away, reopened: it opens.
  - [ ] Reopens on each of: Today, Week, an opened day, Aspirations, an opened aspiration, Keep life running, an opened goal (with back still going where it should), Settings.
  - [ ] List / By goal is kept, and so is a goal's Show all.
  - [ ] A sheet with a text field (check-in, Add) sits above the keyboard, with its field and Save in view.
  - [ ] Left open past midnight (or with the phone's date changed): Today is the new day.
  - [ ] After a new deploy: the new version is running by the second open, with no prompt and no reload in the middle of use.

## Boundaries

- **Always:** test from the installed icon, not a Safari tab; keep storage reads guarded so blocked or damaged storage never stops the app opening; run test, lint and build before each commit.
- **Ask first:** choosing or paying for hosting; any new dependency; changing the icon artwork; any change to caching beyond the app shell.
- **Never:** a network request that the first paint waits on; an update or install prompt; reloading the page under the person's hands.

## Success criteria

- [ ] Every acceptance criterion on #8 is met, including the real-iPhone checklist above.
- [ ] The app opens offline from the home screen on the remembered screen.
- [ ] Today follows the date after the app has been in the background overnight.
- [ ] Updates arrive as described in item 5.
- [ ] Tests above exist and pass; `npm test`, `npm run lint`, `npm run build` pass.

## Open questions

1. **Where is the built app served over HTTPS for the phone?** There's no deploy set up. Options: a static host (GitHub Pages, Cloudflare Pages, Netlify), or a tunnel to `npm run preview` for testing only. A real host also makes the app usable day to day, which the click-through is for. This needs your call when #8 starts, not before.
2. **Mock data resets on every cold start**, so check-offs don't survive a restart until the stored plan and queue exist. Fine for the click-through, or should that follow-up issue be created now?
