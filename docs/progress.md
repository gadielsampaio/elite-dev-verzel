# Challenge requirements and progress

[Documentation index](README.md) · Reviewed 2026-10-26

This checklist follows the local challenge reference `DESAFIO_ELITE_DEV_VERZEL.md`;
the implementation plan `PLANO_IMPLEMENTACAO_ELITE_DEV_VERZEL.md` proposes the
architecture. Challenge rules take precedence. Both reference files are intentionally
ignored by Git; this summary is available in a fresh checkout.

## Current status

| Requirement / plan area | Status and remaining work |
| --- | --- |
| Foundation | NestJS, Prisma migrations, PostgreSQL and Docker implemented. Required React frontend absent. |
| Authentication | Registration, login, JWT and own-profile/admin guards implemented. Auctioneer ownership checks and prohibition on auctioneer bidding await lot/bid workflows. |
| Public item API | Search, artwork details and explicit mock/real transport selection implemented. Local fixtures unblock development; real success remains unverified (Cloudflare 403). Selection UI and snapshots absent. |
| Lots and storefront | Pending: publish image/title/attributes, minimum price, increment and start/end times; show live/scheduled/closed lots; hide cancelled lots. Only owners manage their lots; cancellation before any bids is required. |
| Wallet | Pending: simulated deposits; total, committed and available balances; available = total − committed. |
| Bids | Pending: live window only; first ≥ starting bid, subsequent ≥ current + increment; leader cannot bid again; sufficient available funds; reserve leader funds and release immediately when outbid. Accepted bids in the last two minutes extend the end by two minutes. |
| Live room | Pending: current bid, full history, user position, countdown, winning/outbid state and rejection reasons, updated without reload. |
| Settlement and results | Pending: debit winner, credit auctioneer, shareable receipt; close without winner when no bids; seller totals and bidder participation/wins screens. |
| External outages | Not satisfied yet: published storefront, rooms, audit and receipts must work without Art Institute. Separate health checks alone do not meet this rule. |
| Public audit and privacy | Pending: detect edits/deletions/insertions, including direct database changes; explain verification; no login or personal-data exposure in audit/receipts. `AuditEvent` storage is not tamper detection. |
| Demo seeds | Missing: one auctioneer, two clients and at least one published lot open for bidding. No seed command exists. |
| Delivery | Local setup documented. Public deployment URL and repository visibility not verified; React app and end-to-end demonstration absent. |

The backend has reached part of plan phase 04 (catalog), but phases 01–03 are
not complete end to end. React and early deployment have lagged behind the plan.
The existing `admin` role is an implementation addition, not a required challenge role.

## Next small steps

1. Use mock catalog search/detail to continue the required workflows; revisit live access or another public provider after core functionality works.
2. Add selection UI and persist snapshots during owner-authorized lot publication. Published reads must use local data; plan image availability during provider outages too.
3. Start the required React app and an early public deployment alongside backend increments.
4. Continue with lots → wallets → bids → settlement → public audit → realtime. Add the required demo seeds when those workflows exist.

Adapter is implemented. Facade-style bid orchestration and Observer/realtime remain
planned. The proposed hash chain plus a trusted checkpoint outside PostgreSQL is
also unimplemented; a rewritable database-only chain cannot prove integrity.

## Submission checklist

- Deliver within seven calendar days of receiving the challenge; receipt date is not recorded here.
- Provide name/email, public GitHub repository link(s), and a working public deployment URL.
- Include setup/database instructions, demo seeds, known limitations and an explanation of audit verification.

Docker and automated tests are optional challenge extras already present.
Lot search/filtering, cancellation with automatic refunds and dark mode are optional.
Cancellation **before any bids** is mandatory. Invoicing, resale, native mobile apps
and password recovery are outside the required scope.
