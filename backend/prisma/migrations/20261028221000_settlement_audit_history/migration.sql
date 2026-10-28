-- Settlement legitimately marks a bid as the winner. Capture its receipt in the
-- same journal/transaction so verification can distinguish that transition.
ALTER TABLE bid_audit_history DROP CONSTRAINT bid_audit_history_source_table_check;
ALTER TABLE bid_audit_history ADD CONSTRAINT bid_audit_history_source_table_check
  CHECK (source_table IN ('bids', 'bid_audit_entries', 'auction_results'));
CREATE TRIGGER capture_settlement_history AFTER INSERT OR UPDATE OR DELETE ON auction_results
FOR EACH ROW EXECUTE FUNCTION capture_bid_audit_history();
CREATE TRIGGER prevent_settlement_truncate BEFORE TRUNCATE ON auction_results
FOR EACH STATEMENT EXECUTE FUNCTION capture_bid_audit_history();
