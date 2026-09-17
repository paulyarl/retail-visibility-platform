-- ============================================================================
-- Customer Account Integration Migration
-- ============================================================================
-- This migration adds customer authentication, shipping profiles, and 
-- order-customer relationship support.
--
-- Run in order:
-- 1. Add customer auth fields
-- 2. Create customer_addresses table
-- 3. Add FK relation orders -> customers
-- 4. Create triggers and indexes
-- ============================================================================

-- ============================================================================
-- PART 1: Add Customer Auth Fields
-- ============================================================================

-- Add authentication fields to customers table
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS auth0_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP(6),
  -- Correlation key for traceability (generated from id)
  ADD COLUMN IF NOT EXISTS customer_key VARCHAR(7) UNIQUE;

-- Add index for auth0_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth0_id ON customers(auth0_id);

-- Add unique index for customer_key
CREATE INDEX IF NOT EXISTS idx_customers_customer_key ON customers(customer_key);

-- Add index for password reset token lookups
CREATE INDEX IF NOT EXISTS idx_customers_reset_token ON customers(reset_password_token) 
  WHERE reset_password_token IS NOT NULL;

-- Add index for email verification token lookups
CREATE INDEX IF NOT EXISTS idx_customers_email_verify_token ON customers(email_verification_token)
  WHERE email_verification_token IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE customers IS 'Platform-wide customer records with optional authentication';
COMMENT ON COLUMN customers.auth0_id IS 'Auth0 user ID for OAuth customers (e.g., google-oauth2|123456)';
COMMENT ON COLUMN customers.password_hash IS 'Bcrypt hash for email/password customers';
COMMENT ON COLUMN customers.email_verified IS 'Whether customer email has been verified';
COMMENT ON COLUMN customers.customer_key IS '7-char correlation key (CU + 5 char hash) for traceability in IDs';

-- ============================================================================
-- PART 2: Create Customer Addresses Table (Shipping Profiles)
-- ============================================================================

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  label VARCHAR(100),                          -- "Home", "Work", "Shipping", etc.
  is_default BOOLEAN DEFAULT false,
  is_billing BOOLEAN DEFAULT false,            -- Can be used for billing too
  
  -- Address fields
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'US',
  
  -- Contact info (can differ from customer's main phone)
  phone VARCHAR(20),
  recipient_name VARCHAR(255),                 -- "John Doe" or "Jane Smith (Care Package)"
  
  -- Metadata
  delivery_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_customer_addresses_customer 
    FOREIGN KEY (customer_id) 
    REFERENCES customers(id) 
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT chk_country_code CHECK (LENGTH(country) = 2)
);

-- Indexes for customer_addresses
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default ON customer_addresses(customer_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_active ON customer_addresses(customer_id, is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE customer_addresses IS 'Customer shipping/billing address profiles for faster checkout';
COMMENT ON COLUMN customer_addresses.label IS 'User-defined label like "Home", "Work", "Parents House"';
COMMENT ON COLUMN customer_addresses.is_default IS 'Default shipping address for this customer';
COMMENT ON COLUMN customer_addresses.recipient_name IS 'Optional different recipient name for this address';

-- ============================================================================
-- PART 3: Add FK Relation orders.customer_id -> customers.id
-- ============================================================================

-- First, ensure customer_id column exists (it should, but let's be safe)
-- DO NOT add NOT NULL constraint - guest orders can have null customer_id

-- Add foreign key constraint (allowing NULL for guest orders)
ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_customer 
  FOREIGN KEY (customer_id) 
  REFERENCES customers(id) 
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add order_key column for correlation key storage
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_key VARCHAR(6) UNIQUE;

-- The index idx_orders_customer_id should already exist, but create if not
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Add index for order_key lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_key ON orders(order_key);

-- Comments
COMMENT ON COLUMN orders.customer_id IS 'Reference to customers table. NULL for guest orders, populated for logged-in customers';
COMMENT ON COLUMN orders.order_key IS '6-char correlation key for traceability in IDs and logs';

-- ============================================================================
-- PART 4: Triggers
-- ============================================================================

-- Function: Generate customer_key from customer ID
-- Uses same algorithm as id-generator.ts: MD5 hash -> 5 char alphanumeric
CREATE OR REPLACE FUNCTION generate_customer_key(p_customer_id VARCHAR)
RETURNS VARCHAR(7) AS $$
DECLARE
  hash_value BIGINT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  temp_hash BIGINT;
  key TEXT := '';
BEGIN
  -- Simple hash from customer ID
  hash_value := 0;
  FOR i IN 1..LENGTH(p_customer_id) LOOP
    hash_value := ((hash_value << 5) - hash_value) + ASCII(SUBSTRING(p_customer_id FROM i FOR 1));
    hash_value := hash_value & 2147483647; -- Keep as 32-bit signed
  END LOOP;
  
  -- Convert to 5-char key
  temp_hash := ABS(hash_value);
  FOR i IN 1..5 LOOP
    key := key || SUBSTRING(chars FROM ((temp_hash % LENGTH(chars))::INT + 1) FOR 1);
    temp_hash := temp_hash / LENGTH(chars);
  END LOOP;
  
  RETURN 'CU' || key;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Generate order_key from order ID
-- Uses same algorithm as id-generator.ts: MD5 hash -> 6 char alphanumeric
CREATE OR REPLACE FUNCTION generate_order_key(p_order_id VARCHAR)
RETURNS VARCHAR(6) AS $$
DECLARE
  hash_value BIGINT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  temp_hash BIGINT;
  key TEXT := '';
BEGIN
  -- Simple hash from order ID
  hash_value := 0;
  FOR i IN 1..LENGTH(p_order_id) LOOP
    hash_value := ((hash_value << 5) - hash_value) + ASCII(SUBSTRING(p_order_id FROM i FOR 1));
    hash_value := hash_value & 2147483647; -- Keep as 32-bit signed
  END LOOP;
  
  -- Convert to 6-char key
  temp_hash := ABS(hash_value);
  FOR i IN 1..6 LOOP
    key := key || SUBSTRING(chars FROM ((temp_hash % LENGTH(chars))::INT + 1) FOR 1);
    temp_hash := temp_hash / LENGTH(chars);
  END LOOP;
  
  RETURN key;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: Auto-populate customer_key on customers insert
CREATE OR REPLACE FUNCTION set_customer_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_key IS NULL AND NEW.id IS NOT NULL THEN
    NEW.customer_key := generate_customer_key(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_customer_key ON customers;
CREATE TRIGGER trigger_set_customer_key
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION set_customer_key();

-- Trigger: Auto-populate order_key on orders insert
CREATE OR REPLACE FUNCTION set_order_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_key IS NULL AND NEW.id IS NOT NULL THEN
    NEW.order_key := generate_order_key(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_key ON orders;
CREATE TRIGGER trigger_set_order_key
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_key();

-- Trigger: Update updated_at on customer_addresses
CREATE OR REPLACE FUNCTION update_customer_address_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER trigger_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_address_updated_at();

-- Trigger: Ensure only one default address per customer
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE customer_addresses 
    SET is_default = false 
    WHERE customer_id = NEW.customer_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_default_address ON customer_addresses;
CREATE TRIGGER trigger_single_default_address
  BEFORE INSERT OR UPDATE ON customer_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_address();

-- Trigger: Populate customer_id on orders from customer_email if customer exists
-- This helps link guest orders to existing customers
CREATE OR REPLACE FUNCTION link_order_to_customer()
RETURNS TRIGGER AS $$
DECLARE
  existing_customer_id VARCHAR(255);
BEGIN
  -- Only try to link if customer_id is NULL and customer_email is set
  IF NEW.customer_id IS NULL AND NEW.customer_email IS NOT NULL THEN
    -- Find existing customer by email
    SELECT id INTO existing_customer_id 
    FROM customers 
    WHERE email = LOWER(NEW.customer_email)
    LIMIT 1;
    
    IF existing_customer_id IS NOT NULL THEN
      NEW.customer_id := existing_customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_link_order_to_customer ON orders;
CREATE TRIGGER trigger_link_order_to_customer
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION link_order_to_customer();

-- Trigger: Update customer analytics after order completion
CREATE OR REPLACE FUNCTION update_customer_order_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update on confirmed orders
  IF NEW.order_status IN ('confirmed', 'processing', 'shipped', 'delivered') 
     AND (TG_OP = 'INSERT' OR OLD.order_status != NEW.order_status) THEN
    
    -- Update customer platform stats
    UPDATE customers SET
      platform_orders = COALESCE(platform_orders, 0) + 1,
      platform_value_cents = COALESCE(platform_value_cents, 0) + NEW.total_cents,
      last_platform_order_at = NEW.created_at,
      first_platform_order_at = COALESCE(first_platform_order_at, NEW.created_at),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.customer_id;
    
    -- Update or create customer_tenant_relationships
    -- ID format: ctr-{tenantKey}-{customerKey}-{nanoid} for traceability
    -- Uses stored customer_key from customers table
    INSERT INTO customer_tenant_relationships (
      id, customer_id, tenant_id, tenant_orders, tenant_value_cents,
      first_tenant_order_at, last_tenant_order_at, customer_segment
    ) VALUES (
      CONCAT('ctr-', 
        (SELECT tenant_key FROM tenants WHERE id = NEW.tenant_id LIMIT 1), '-',
        (SELECT customer_key FROM customers WHERE id = NEW.customer_id LIMIT 1), '-',
        SUBSTRING(MD5(GEN_RANDOM_UUID()::text) FROM 1 FOR 6)
      ),
      NEW.customer_id,
      NEW.tenant_id,
      1,
      NEW.total_cents,
      NEW.created_at,
      NEW.created_at,
      'new'
    )
    ON CONFLICT (customer_id, tenant_id) DO UPDATE SET
      tenant_orders = customer_tenant_relationships.tenant_orders + 1,
      tenant_value_cents = customer_tenant_relationships.tenant_value_cents + NEW.total_cents,
      last_tenant_order_at = NEW.created_at,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_analytics ON orders;
CREATE TRIGGER trigger_update_customer_analytics
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_order_analytics();

-- ============================================================================
-- PART 6: Utility Functions
-- ============================================================================

-- Function: Get or create customer from email (for guest checkout)
CREATE OR REPLACE FUNCTION get_or_create_customer(
  p_email VARCHAR(255),
  p_first_name VARCHAR(255) DEFAULT NULL,
  p_last_name VARCHAR(255) DEFAULT NULL,
  p_phone VARCHAR(20) DEFAULT NULL
) RETURNS VARCHAR(255) AS $$
DECLARE
  v_customer_id VARCHAR(255);
  v_customer_number VARCHAR(255);
BEGIN
  -- Try to find existing customer
  SELECT id INTO v_customer_id 
  FROM customers 
  WHERE email = LOWER(p_email)
  LIMIT 1;
  
  -- If not found, create new customer
  IF v_customer_id IS NULL THEN
    v_customer_number := CONCAT('CUST', EXTRACT(EPOCH FROM NOW())::BIGINT, UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)));
    v_customer_id := CONCAT('cust_', SUBSTRING(MD5(GEN_RANDOM_UUID()::TEXT) FROM 1 FOR 20));
    
    INSERT INTO customers (
      id, customer_number, email, first_name, last_name, phone,
      preferred_language, timezone, email_consent
    ) VALUES (
      v_customer_id, v_customer_number, LOWER(p_email), p_first_name, p_last_name, p_phone,
      'en', 'UTC', true
    );
  END IF;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get customer's default shipping address
CREATE OR REPLACE FUNCTION get_customer_default_address(
  p_customer_id VARCHAR(255)
) RETURNS TABLE (
  id VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(2),
  phone VARCHAR(20),
  recipient_name VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.address_line1,
    ca.address_line2,
    ca.city,
    ca.state,
    ca.postal_code,
    ca.country,
    ca.phone,
    ca.recipient_name
  FROM customer_addresses ca
  WHERE ca.customer_id = p_customer_id
    AND ca.is_default = true
    AND ca.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get customer order history across all tenants
CREATE OR REPLACE FUNCTION get_customer_order_history(
  p_customer_id VARCHAR(255),
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  order_id VARCHAR(255),
  order_number VARCHAR(255),
  tenant_id VARCHAR(255),
  tenant_name VARCHAR(255),
  total_cents INT,
  order_status VARCHAR(50),
  created_at TIMESTAMP(6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.tenant_id,
    t.name,
    o.total_cents,
    o.order_status::TEXT,
    o.created_at
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.customer_id = p_customer_id
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: Views
-- ============================================================================

-- View: Customers with their default address
CREATE OR REPLACE VIEW customers_with_default_address AS
SELECT 
  c.id,
  c.customer_number,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.email_verified,
  c.platform_orders,
  c.platform_value_cents,
  c.last_platform_order_at,
  ca.address_line1 AS default_address_line1,
  ca.city AS default_city,
  ca.state AS default_state,
  ca.postal_code AS default_postal_code,
  ca.country AS default_country
FROM customers c
LEFT JOIN customer_addresses ca ON ca.customer_id = c.id AND ca.is_default = true AND ca.is_active = true;

-- View: Customer order summary by tenant
CREATE OR REPLACE VIEW customer_tenant_summary AS
SELECT 
  c.id AS customer_id,
  c.email,
  c.first_name,
  c.last_name,
  ctr.tenant_id,
  ctr.tenant_orders,
  ctr.tenant_value_cents,
  ctr.customer_segment,
  ctr.loyalty_points,
  ctr.last_tenant_order_at
FROM customers c
JOIN customer_tenant_relationships ctr ON ctr.customer_id = c.id
WHERE ctr.is_active = true;

-- ============================================================================
-- PART 8: Seed Data for Testing (Optional - comment out in production)
-- ============================================================================

-- Uncomment to create test customer with addresses
/*
INSERT INTO customers (id, customer_number, email, first_name, last_name, phone, email_verified)
VALUES ('cust_test_001', 'CUST_TEST_001', 'test@example.com', 'Test', 'Customer', '555-123-4567', true);

INSERT INTO customer_addresses (id, customer_id, label, is_default, address_line1, city, state, postal_code, country)
VALUES 
  ('addr_test_001', 'cust_test_001', 'Home', true, '123 Main Street', 'New York', 'NY', '10001', 'US'),
  ('addr_test_002', 'cust_test_001', 'Work', false, '456 Office Blvd', 'New York', 'NY', '10002', 'US');
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify the migration succeeded:
/*
-- Check customers table has new columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('auth0_id', 'password_hash', 'email_verified', 'last_login_at');

-- Check customer_addresses table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'customer_addresses';

-- Check customer_sessions table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'customer_sessions';

-- Check FK constraint on orders
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_name = 'orders' AND constraint_type = 'FOREIGN KEY';

-- Check triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('customers', 'customer_addresses', 'customer_sessions', 'orders')
ORDER BY tablename, indexname;
*/
