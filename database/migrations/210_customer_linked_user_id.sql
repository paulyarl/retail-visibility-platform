-- Migration 210: Customer-to-User link for directory claim bridge
--
-- When a customer accepts a directory presence claim, they are promoted to a
-- platform user (tenants admin). This column links the customer record to the
-- platform users record so the promotion is idempotent.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS linked_user_id VARCHAR(255) NULL;

ALTER TABLE customers
  ADD CONSTRAINT fk_customers_linked_user
  FOREIGN KEY (linked_user_id) REFERENCES users(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_linked_user_id
  ON customers (linked_user_id)
  WHERE linked_user_id IS NOT NULL;
