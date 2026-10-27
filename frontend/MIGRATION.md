# HAUS SAMPAIO migration

The input ZIP is a vanilla HTML/CSS/JavaScript prototype, distinct from the
repository's existing API-backed React frontend. No screenshot files accompanied
the input. The served ZIP pages were therefore the available visual reference;
comparison against separately supplied screenshots remains possible when available.
The ZIP's README/design notes were treated as reference material, not additional
authorization or changes to the requested scope.

## Structure and migration stages

1. Inspect the seven HTML pages, shared partials, six CSS files, and imperative
   application script. Identify the demo's data ownership and persistence.
2. Reuse all six stylesheets verbatim and move fixtures/translations into typed
   modules. Replace HTML fetching and global inline handlers with React rendering.
3. Extract layout, catalogue, forms, dialogs, and seller components. Move shared
   demo state into `HausProvider`; keep field/search state with the owning view.
4. Verify strict TypeScript compilation, a production Vite build, browser flows,
   and desktop/mobile light/dark renders against the served original.

| Module | Responsibility |
| --- | --- |
| `HausApp.tsx` | Compose views and overlays; preserve view state across navigation |
| `model.tsx`, `types.ts` | Typed lots/profiles, hash navigation, theme, clock, demo operations |
| `Layout.tsx` | Header, footer, demo-profile dialog |
| `HomePage.tsx` | Hero carousel, searchable/filterable collection, reusable lot cards |
| `AuthPage.tsx` | Shared login/registration fields and validation |
| `LotRoom.tsx` | Artwork inspection, zoom, bidding and history |
| `UtilityPages.tsx` | Shared utility layout, wallet, activity and audit |
| `SellerStudio.tsx` | Seller collection, results, publication and cancellation |
| `SellerSearch.tsx`, `catalog.ts` | Abortable museum search, pagination, typed normalization |
| `SellerDetails.tsx` | Artwork metadata, schedule and currency fields, draft validation |
| `shared.tsx` | Back action, currency entry, focus-managed modal |

The original prototype is now isolated at `/preview`; its hash pages retain the original `#/home`, `#/login`, `#/register`, `#/wallet`, `#/activity`, `#/audit`, and `#/seller` suffixes.
The `/` entry now connects authentication, public lot/room reads and wallets to
the API. See [integration status](../docs/frontend-integration.md). The existing API
application remains at `/lots`, `/lots/:id`, `/login`, and `/wallet`; its CSS is
loaded in a separate entry bundle. Its existing tests still exercise these routes.
No dependencies were added.

## Preserved behavior and compatibility

- Original copy, artwork URLs, fonts, CSS ordering, theme colors, responsive
  breakpoints, EN/PT translations, and demo-profile choices.
- Carousel rotation, filters/search, countdowns, room tilt/zoom/captions,
  bid validation/history, wallet deposits, and seller search/sample/create/cancel.
- Forms validate but do not authenticate, transmit, or persist credentials.
  Existing API authentication and wallet operations remain in the API application.
- `haus-sampaio-theme` and `haus-sampaio-seller-demo-v1` retain their names and
  shapes (`newLots`, `cancelled`). New lots retain museum source snapshots.
  No storage deletion or backend/schema migration is performed. Existing stored
  lots are read defensively. Failed persistence is surfaced to the user.
- Demo balances and profiles remain in memory; seller lots/cancellations persist.
- Effects clean up timers, listeners, animation frames, and outstanding requests.
  Dialogs trap focus, close with Escape, and restore focus; the background is inert.
- One isolated CSS correction (`styles/react.css`) prevents loaded landscape
  artwork from expanding the mobile grid beyond its existing card width. The
  original six stylesheets remain byte-for-byte unchanged.

Rollback: restore the prior `src/main.tsx` and `index.html` from Git to restore
its default `/lots` landing page. The API screens and session code are preserved;
no data rollback is necessary. The original ZIP is not modified.

## Verification

```sh
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# With Vite running on port 5174:
PLAYWRIGHT_CHANNEL=chrome node scripts/capture-haus.mjs
# Optional original baseline, served separately:
PLAYWRIGHT_CHANNEL=chrome node scripts/capture-haus.mjs http://127.0.0.1:5176 verification/original
```

The browser suite retains eight existing API regressions and six preview migration
scenarios, plus connected HAUS contract checks. Preview scenarios cover catalogue/room/bids, form validation/theme/language, wallet
and history navigation, seller publication/persistence/cancellation, catalog
failure/pagination/selection, and mobile layout/dialog keyboard behavior.

Render checks cover all seven views at 1440×1000 and 390×844 in both themes.
External museum images and Google Fonts still require network access, as in the
source. Image loading and live countdowns can differ between captures; screenshots
are review evidence rather than a claim of pixel identity. Generated screenshots
are kept in ignored `verification/`, not shipped with the application.
