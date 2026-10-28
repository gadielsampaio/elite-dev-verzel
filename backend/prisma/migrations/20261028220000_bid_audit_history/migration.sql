-- No backfill: pre-migration rows are not retroactively certified.
-- Deliberately no FK: evidence survives bid/lot deletion and cascades.
CREATE TABLE bid_audit_history (
  id BIGSERIAL PRIMARY KEY,
  lot_id UUID NOT NULL,
  source_table TEXT NOT NULL CHECK (source_table IN ('bids', 'bid_audit_entries')),
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  transaction_id BIGINT NOT NULL DEFAULT txid_current(),
  recorded_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  old_row JSONB,
  new_row JSONB
);
CREATE INDEX bid_audit_history_lot_id_id_idx ON bid_audit_history(lot_id, id);
REVOKE ALL ON bid_audit_history FROM PUBLIC;
REVOKE ALL ON SEQUENCE bid_audit_history_id_seq FROM PUBLIC;

CREATE FUNCTION protect_bid_audit_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Bid audit history is append-only and trigger-managed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_bid_audit_history_rows
BEFORE INSERT OR UPDATE OR DELETE ON bid_audit_history
FOR EACH ROW EXECUTE FUNCTION protect_bid_audit_history();
CREATE TRIGGER protect_bid_audit_history_truncate
BEFORE TRUNCATE ON bid_audit_history
FOR EACH STATEMENT EXECUTE FUNCTION protect_bid_audit_history();

CREATE FUNCTION capture_bid_audit_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  before_row JSONB;
  after_row JSONB;
  previous_lot UUID;
  current_lot UUID;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Cannot truncate audited bid history';
  END IF;
  IF TG_OP <> 'INSERT' THEN
    before_row := to_jsonb(OLD);
    previous_lot := OLD.lot_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    after_row := to_jsonb(NEW);
    current_lot := NEW.lot_id;
  END IF;
  EXECUTE format('INSERT INTO %I.bid_audit_history (lot_id, source_table, operation, old_row, new_row) VALUES ($1,$2,$3,$4,$5)', TG_TABLE_SCHEMA)
    USING coalesce(previous_lot, current_lot), TG_TABLE_NAME, TG_OP, before_row, after_row;
  -- Moving a row damages both lots; retain evidence under both IDs.
  IF previous_lot IS NOT NULL AND current_lot IS NOT NULL AND previous_lot <> current_lot THEN
    EXECUTE format('INSERT INTO %I.bid_audit_history (lot_id, source_table, operation, old_row, new_row) VALUES ($1,$2,$3,$4,$5)', TG_TABLE_SCHEMA)
      USING current_lot, TG_TABLE_NAME, TG_OP, before_row, after_row;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION capture_bid_audit_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_bid_audit_history() FROM PUBLIC;
CREATE TRIGGER capture_bids_history AFTER INSERT OR UPDATE OR DELETE ON bids
FOR EACH ROW EXECUTE FUNCTION capture_bid_audit_history();
CREATE TRIGGER capture_bid_snapshots_history AFTER INSERT OR UPDATE OR DELETE ON bid_audit_entries
FOR EACH ROW EXECUTE FUNCTION capture_bid_audit_history();
CREATE TRIGGER prevent_bids_truncate BEFORE TRUNCATE ON bids
FOR EACH STATEMENT EXECUTE FUNCTION capture_bid_audit_history();
CREATE TRIGGER prevent_bid_snapshots_truncate BEFORE TRUNCATE ON bid_audit_entries
FOR EACH STATEMENT EXECUTE FUNCTION capture_bid_audit_history();
