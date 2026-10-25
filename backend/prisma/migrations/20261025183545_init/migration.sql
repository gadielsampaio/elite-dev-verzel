-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'bidder', 'auctioneer');

-- CreateEnum
CREATE TYPE "lot_status" AS ENUM ('draft', 'scheduled', 'open', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "wallet_transaction_type" AS ENUM ('deposit', 'withdrawal', 'auction_purchase', 'auction_sale', 'refund');

-- CreateEnum
CREATE TYPE "wallet_hold_status" AS ENUM ('active', 'released', 'captured');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "lot_status" NOT NULL DEFAULT 'draft',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "starting_bid" DECIMAL(19,2) NOT NULL,
    "bid_increment" DECIMAL(19,2) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "estimated_value" DECIMAL(19,2) NOT NULL,
    "image_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "artic_artwork_id" INTEGER,
    "artic_image_id" TEXT,
    "artist_display" TEXT,
    "credit_line" TEXT,
    "is_public_domain" BOOLEAN,
    "source_snapshot" JSONB,
    "source_fetched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "bidder_id" UUID NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "invalidated_at" TIMESTAMPTZ(6),
    "invalidation_reason" TEXT,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "status" "wallet_hold_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),
    "captured_at" TIMESTAMPTZ(6),

    CONSTRAINT "wallet_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "winner_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "winning_bid_id" UUID NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "type" "wallet_transaction_type" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "auction_result_id" UUID,
    "transfer_id" UUID,
    "external_reference" TEXT,
    "idempotency_key" UUID NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "request_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "lots_owner_id_idx" ON "lots"("owner_id");

-- CreateIndex
CREATE INDEX "lots_status_end_time_idx" ON "lots"("status", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "lots_id_owner_id_key" ON "lots"("id", "owner_id");

-- CreateIndex
CREATE INDEX "items_lot_id_idx" ON "items"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_lot_id_artic_artwork_id_key" ON "items"("lot_id", "artic_artwork_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_idempotency_key_key" ON "bids"("idempotency_key");

-- CreateIndex
CREATE INDEX "bids_lot_id_amount_created_at_idx" ON "bids"("lot_id", "amount" DESC, "created_at");

-- CreateIndex
CREATE INDEX "bids_bidder_id_idx" ON "bids"("bidder_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_id_lot_id_bidder_id_key" ON "bids"("id", "lot_id", "bidder_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_holds_bid_id_key" ON "wallet_holds"("bid_id");

-- CreateIndex
CREATE INDEX "wallet_holds_wallet_id_status_idx" ON "wallet_holds"("wallet_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_results_lot_id_key" ON "auction_results"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "auction_results_winning_bid_id_key" ON "auction_results"("winning_bid_id");

-- CreateIndex
CREATE INDEX "auction_results_winner_id_idx" ON "auction_results"("winner_id");

-- CreateIndex
CREATE INDEX "auction_results_owner_id_idx" ON "auction_results"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "auction_results_lot_id_owner_id_key" ON "auction_results"("lot_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "auction_results_winning_bid_id_lot_id_winner_id_key" ON "auction_results"("winning_bid_id", "lot_id", "winner_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_transfer_id_idx" ON "wallet_transactions"("transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_auction_result_id_type_key" ON "wallet_transactions"("auction_result_id", "type");

-- CreateIndex
CREATE INDEX "audit_events_lot_id_created_at_idx" ON "audit_events"("lot_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_winning_bid_id_lot_id_winner_id_fkey" FOREIGN KEY ("winning_bid_id", "lot_id", "winner_id") REFERENCES "bids"("id", "lot_id", "bidder_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_auction_result_id_fkey" FOREIGN KEY ("auction_result_id") REFERENCES "auction_results"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
