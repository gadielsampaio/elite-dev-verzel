# Challenge requirements and progress

[Documentation index](README.md) · Reviewed 2026-10-27

This checklist follows the local challenge reference `DESAFIO_ELITE_DEV_VERZEL.md`;
the implementation plan `PLANO_IMPLEMENTACAO_ELITE_DEV_VERZEL.md` proposes the
architecture. Challenge rules take precedence. Both reference files are intentionally
ignored by Git; this summary is available in a fresh checkout.

## Current status

| Requirement / plan area | Status and remaining work |
| --- | --- |
| Foundation | NestJS, Prisma migrations, PostgreSQL and Docker implemented. Initial React/Vite frontend implemented. |
| Authentication | Registration/login UI, JWT and own-profile/admin guards implemented. Lot publication is auctioneer-only with JWT-derived ownership. Cancellation requires the owning auctioneer. Bid placement rejects auctioneers/admins and self-owned lots. |
| Public item API | Search, artwork details and explicit mock/real transport selection implemented. Cleveland live search/detail verified; Cleveland fixtures remain available. Snapshots are persisted during publication; selection UI absent. |
| Lots and storefront | Single-artwork publication, paginated status listings, saved details and owner cancellation before any bids implemented. Lifecycle reconciles on reads; Public browsing/detail UI implemented; seller management UI, editing and background settlement remain pending. |
| Wallet | Own balances and bidder-only simulated deposits implemented in API/UI. Concurrent retries are idempotent. Bid placement reserves leader funds and atomically releases the previous hold. |
| Bids | Placement API implements timing, minimum/increment, leader restriction, funds, atomic holds, concurrent retries and two-minute anti-sniping. Public paginated history/current leader and protected own-position reads implemented. Bid UI and tamper-evident recording remain pending. |
| Live room | API reads expose current bid, history, user position and deadline. Room UI and realtime updates remain pending. |
| Settlement and results | Pending: debit winner, credit auctioneer, shareable receipt; close without winner when no bids; seller totals and bidder participation/wins screens. |
| External outages | Not satisfied yet: published storefront, rooms, audit and receipts must work without the museum provider. Lot details now read saved snapshots without the provider; image URLs still depend on the remote host. |
| Public audit and privacy | Pending: detect edits/deletions/insertions, including direct database changes; explain verification; no login or personal-data exposure in audit/receipts. `AuditEvent` storage is not tamper detection. |
| Demo seeds | Missing: one auctioneer, two clients and at least one published lot open for bidding. No seed command exists. |
| Delivery | Local setup documented. Public deployment URL and repository visibility not verified; Initial React app available locally; complete auction demonstration and deployment pending. |

The backend has reached part of plan phase 07 (bidding), but phases 01–03 are
not complete end to end. The initial React UI now covers auth, browsing and wallets; seller UI and early public deployment remain gaps.
The existing `admin` role is an implementation addition, not a required challenge role.

## Next small steps

1. Use the Cleveland catalog for publication; retain explicit mock mode for offline development.
2. Add idempotent background settlement to resolve holds at close; finish the bid UI afterward.
3. Add seller catalog/publication/cancellation UI and an early public deployment. Plan image availability during provider outages.
4. Continue with lots → wallets → bids → settlement → public audit → realtime. Add the required demo seeds when those workflows exist.

Adapter and Facade-style orchestration in `BidsService` are implemented. Observer/
realtime remain planned. The proposed hash chain plus a trusted checkpoint outside PostgreSQL is
also unimplemented; a rewritable database-only chain cannot prove integrity.

## Submission checklist

- Deliver within seven calendar days of receiving the challenge; receipt date is not recorded here.
- Provide name/email, public GitHub repository link(s), and a working public deployment URL.
- Include setup/database instructions, demo seeds, known limitations and an explanation of audit verification.

Docker and automated tests are optional challenge extras already present.
Lot search/filtering, cancellation with automatic refunds and dark mode are optional.
Cancellation **before any bids** is mandatory. Invoicing, resale, native mobile apps
and password recovery are outside the required scope.
