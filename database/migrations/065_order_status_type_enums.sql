-- Migration 065: Add product-type-specific order and fulfillment statuses
-- Adds: order_status: access_granted, scheduled, in_progress
-- Adds: fulfillment_status: digitally_delivered

-- Add new order_status values
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'access_granted';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_progress';

-- Add new fulfillment_status value
ALTER TYPE fulfillment_status ADD VALUE IF NOT EXISTS 'digitally_delivered';
