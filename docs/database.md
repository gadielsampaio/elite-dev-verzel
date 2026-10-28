# Database schema

[Documentation index](README.md) · [Prisma source](../backend/prisma/schema.prisma)

The schema defines storage for auction operations; it does not implement the
business workflows. All nine entities have a database-generated UUID `id` and a
`createdAt` timestamp defaulting to now. Timestamps use `timestamptz(6)`, monetary
values use `Decimal(19,2)`, and JSON fields use `jsonb`. Prisma uses camelCase field
names mapped to snake_case SQL columns. `?` below means nullable.

## Entities and fields

The fields below are in addition to the common `id` and `createdAt` fields.

| Entity / table                              | Responsibility and fields                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User` / `users`                            | Participant identity: `name`, unique `email`, `role`, `isActive` (default true), `updatedAt`. Nullable `passwordHash` stores bcrypt hashes; never returned by user endpoints.                                                                                                                                                             |
| `Wallet` / `wallets`                        | One wallet per user: unique `userId`, `currency` (`char(3)`, default USD). No stored balance field.                                                                                                                                                                                                                                       |
| `Lot` / `lots`                              | Auction unit: `ownerId`, `title`, `description?`, `status` (default draft), `currency` (`char(3)`, default USD), `startTime`, `endTime`, `startingBid`, `bidIncrement`, `cancelledAt?`, `cancellationReason?`, `updatedAt`.                                                                                                               |
| `Item` / `items`                            | Lot contents: `lotId`, `name`, `description?`, `estimatedValue`, `imageUrl?`, `position` (default 0), `updatedAt`. Optional source metadata: `articArtworkId?` (integer), `articImageId?`, `artistDisplay?`, `creditLine?`, `isPublicDomain?`, `sourceSnapshot?` (JSON), `sourceFetchedAt?`. Publication saves a provider-tagged snapshot; legacy articArtworkId stores the selected provider ID. |
| `Bid` / `bids`                              | Offer on a lot: `lotId`, `bidderId`, `amount`, `isActive` (default true), `isWinner` (default false), `invalidatedAt?`, `invalidationReason?`, unique UUID `idempotencyKey`. Being outbid does not itself deactivate a bid.                                                                                                               |
| `WalletHold` / `wallet_holds`               | Reservation record linked to a bid: `walletId`, unique `bidId`, `amount`, `status` (default active), `releasedAt?`, `capturedAt?`.                                                                                                                                                                                                        |
| `AuctionResult` / `auction_results`         | Outcome and settlement timestamps: unique `lotId`, `winnerId`, `ownerId`, unique `winningBidId`, `endedAt`, `settledAt?`.                                                                                                                                                                                                                 |
| `WalletTransaction` / `wallet_transactions` | Financial entry: `walletId`, `type`, `amount`, `auctionResultId?`, `transferId?` (UUID), `externalReference?`, unique UUID `idempotencyKey`, `description?`.                                                                                                                                                                              |
| `AuditEvent` / `audit_events`               | History record: `lotId?`, `actorId?`, `action`, `entityType`, UUID `entityId`, UUID `requestId?`, `beforeData?`, `afterData?`, `metadata?` (JSON).                                                                                                                                                                                        |

`User`, `Lot`, and `Item` have `updatedAt` with `@default(now()) @updatedAt`.
Prisma updates this field on writes; the migration does not install SQL update triggers.

## Relationships

- A user has zero or one wallet, many owned lots, many bids, and many audit events.
  Users also relate to results as winners (`AuctionWinner`) and sellers (`AuctionOwner`).
- A lot has one owner, many items and bids, zero or one result, and many audit events.
- A bid has one bidder and lot, zero or one hold, and zero or one result.
- A wallet has many holds and transactions. Each hold references one wallet and bid.
- A result references a lot, its owner, the winning bid, and its bidder as winner;
  it can have many transactions. A transaction optionally references a result.
- Audit events optionally reference a lot and actor. `entityId` is a generic UUID,
  not a foreign key. `transferId` and `requestId` are correlation values, not relations.

## Enums

| Prisma enum             | Values                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| `UserRole`              | `admin`, `bidder`, `auctioneer`                                       |
| `LotStatus`             | `draft`, `scheduled`, `open`, `closed`, `cancelled`                   |
| `WalletTransactionType` | `deposit`, `withdrawal`, `auction_purchase`, `auction_sale`, `refund` |
| `WalletHoldStatus`      | `active`, `released`, `captured`                                      |

## Enforced constraints and indexes

- All declared foreign keys use `Restrict` for deletion and update; there are no
  cascading deletes.
- Email is unique; wallet `userId`, hold `bidId`, result `lotId`, and result
  `winningBidId` are unique. Bid and transaction idempotency keys are each unique
  within their own table; deposits and bid placement enforce safe replay.
- Item `(lotId, articArtworkId)` is unique. PostgreSQL allows multiple rows with
  null artwork IDs in this constraint.
- Lot `(id, ownerId)` and bid `(id, lotId, bidderId)` are composite unique keys.
  Result composite foreign keys enforce that the owner matches the lot and the
  winning bid matches both the lot and winner. Results also have composite unique
  keys `(lotId, ownerId)` and `(winningBidId, lotId, winnerId)`.
- Transaction `(auctionResultId, type)` permits at most one entry per type for a
  non-null result, across all wallets. Rows with a null result are not limited by
  that pair. This matters when designing settlement and refund flows.
- Lookup indexes cover lot owner/status/end time; item lot; bid lot/amount
  descending/creation time and bidder; hold wallet/status; result winner/owner;
  transaction wallet/time and transfer; audit lot/time, entity/time, and actor.

## Financial and audit semantics

Transactions store financial entries, holds represent reservations associated
with bids, and results link the winning bid to the lot and settlement timestamps.
Audit events can record before/after state and request context. These structures
exist. Simulated deposits and ledger/active-hold balance calculation are implemented.
Bid placement reserves/releases holds atomically. Capture and settlement are implemented; accepted bids now also persist hash-linked snapshots. Trigger-backed audit history and public verification are implemented; external witnesses are optional; `isWinner` is not set just because a bid leads.

The schema and initial migration do not enforce positive amounts, sufficient
funds, matching currencies, auction time ordering, role permissions, one
`isWinner=true` bid per lot, or equality between a hold's wallet owner and bidder.
They also do not enforce paired transfers, immutable financial records, or
status/timestamp consistency. These remain business-rule design and implementation
work, not guarantees provided by the current database.

For the challenge, `AuditEvent` remains general-purpose storage; tamper detection
uses `BidAuditEntry` and the trigger-managed `BidAuditHistory`. `Item.sourceSnapshot` and `sourceFetchedAt`
are populated atomically with a lot during publication, preserving normalized
catalog details and the mock/real provider marker. `AuctionResult` requires a
winner; a no-bid closure must not invent one. See [remaining requirements](progress.md).


## Accepted-bid audit snapshots

`BidAuditEntry` maps to `bid_audit_entries`: bidId (UUID primary key), lotId,
sequence, previousHash/hash, bidderAlias, exact amount/currency, acceptedAt and
the resulting endTime. The lot/sequence pair is unique. Bid IDs have no foreign
key to Bid, so deleting a bid preserves evidence; lot deletion cascades snapshots.
The database enforces positive sequence/amount and valid hash/link shape.
See [audit rollout and limitations](audit.md). Existing bids are not backfilled.

## Supplementary trigger history

`BidAuditHistory` / `bid_audit_history` records `id`, `lotId`, `sourceTable`,
`operation`, `transactionId`, `recordedAt`, `oldRow` and `newRow`. Row triggers on
bids, accepted snapshots and settlement receipts capture direct SQL changes atomically. The table has
no cascading foreign keys; evidence survives lot deletion. Guard triggers reject
direct writes and truncation. No pre-migration backfill is performed.
See [permissions and administrator limitations](audit.md#trust-boundary).

## Refresh sessions

`RefreshSession` / `refresh_sessions` stores user/family UUIDs, a unique SHA-256
token hash, expiry, consumption/revocation timestamps and creation time. User
deletion cascades sessions. Rotation consumes one row and inserts its successor
under a family lock; replay revokes the entire family. Raw tokens are never stored.

## Auction room image quality

New lot items save `imageUrl` (web preview) and `printImageUrl` (the highest-resolution
browser-ready JPEG), also retained in the source snapshot. The room shows the web
image first and switches only after the print image has decoded. Failed or missing
print images keep the web preview. Archival TIFF URLs are not retained.
Existing items remain compatible; missing print URLs are not inferred from filenames.
