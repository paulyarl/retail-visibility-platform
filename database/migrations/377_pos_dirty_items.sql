-- 377_pos_dirty_items.sql — POS_STOCK_SYNC_SPEC §5 / sprint P3
--
-- Webhook work queue for POS stock sync. Provider webhook events are
-- signal-only (no stock numbers), so the receiver inserts dirty rows and
-- the pos-dirty-flush job groups them by integration and re-pulls real
-- stock from the POS. pos_item_id NULL means "whole integration dirty"
-- (order/payment events where the affected items aren't named).

CREATE TABLE IF NOT EXISTS pos_dirty_items (
  id              TEXT        PRIMARY KEY,
  provider        TEXT        NOT NULL,            -- 'clover' | 'square' | ...
  integration_id  TEXT        NOT NULL,            -- clover_integrations_list.id etc.
  pos_item_id     TEXT,                            -- provider item id; NULL = whole-integration
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  flushed_at      TIMESTAMPTZ
);

-- The flush job's hot path: unflushed rows grouped by integration.
CREATE INDEX IF NOT EXISTS idx_pos_dirty_items_unflushed
  ON pos_dirty_items (provider, integration_id)
  WHERE flushed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_dirty_items_queued_at
  ON pos_dirty_items (queued_at);
