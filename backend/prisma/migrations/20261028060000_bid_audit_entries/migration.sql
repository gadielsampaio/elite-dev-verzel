CREATE TABLE "bid_audit_entries" (
  "bid_id" UUID NOT NULL,
  "lot_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "previous_hash" CHAR(64),
  "hash" CHAR(64) NOT NULL,
  "bidder_alias" VARCHAR(39) NOT NULL,
  "amount" DECIMAL(19,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3) NOT NULL,
  "end_time" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "bid_audit_entries_pkey" PRIMARY KEY ("bid_id"),
  CONSTRAINT "bid_audit_entries_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "bid_audit_entries_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "bid_audit_entries_hash_check" CHECK ("hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "bid_audit_entries_previous_check" CHECK (
    ("sequence" = 1 AND "previous_hash" IS NULL) OR
    ("sequence" > 1 AND "previous_hash" IS NOT NULL AND "previous_hash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "bid_audit_entries_lot_id_fkey" FOREIGN KEY ("lot_id")
    REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "bid_audit_entries_lot_id_sequence_key" ON "bid_audit_entries"("lot_id", "sequence");
