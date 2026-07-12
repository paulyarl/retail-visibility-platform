/**
 * Admin routes for Cross-Capability Constraint management.
 *
 * CCL Phase 4: DB-driven constraints.
 * CRUD operations on capability_constraints_list table.
 */

import { Router } from 'express';
import { prisma } from '../../prisma';
import { z } from 'zod';
import { invalidateConstraintCache } from '../../services/resolvers';

const router = Router();

// ====================
// CONSTRAINT METADATA
// Static metadata derived from apps/api/src/services/resolvers/types.ts
// Used by the admin UI to populate dropdowns in the constraint form.
// ====================

type FieldType = 'string' | 'boolean' | 'array';

interface FieldMeta {
  field: string;
  label: string;
  value_type: FieldType;
  operators: string[];
  values?: string[];
}

interface CapabilityMeta {
  key: string;
  label: string;
  fields: FieldMeta[];
}

interface ConstraintMetadata {
  capabilities: CapabilityMeta[];
  operators: string[];
  types: string[];
  severities: string[];
}

const STRING_OPS = ['equals'];
const ARRAY_OPS = ['includes', 'not_includes'];
const BOOL_OPS = ['is_true', 'is_false'];

const CONSTRAINT_METADATA: ConstraintMetadata = {
  capabilities: [
    {
      key: 'storefront',
      label: 'Storefront',
      fields: [
        { field: 'effective_type', label: 'Effective Type', value_type: 'string', operators: STRING_OPS, values: ['online', 'retail', 'service', 'social', 'flexible', 'none'] },
        { field: 'allowed_types', label: 'Allowed Types', value_type: 'array', operators: ARRAY_OPS, values: ['online', 'retail', 'service', 'social', 'flexible', 'none'] },
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'product_types',
      label: 'Product Types',
      fields: [
        { field: 'effective_type', label: 'Effective Type', value_type: 'string', operators: STRING_OPS, values: ['physical', 'digital', 'hybrid', 'service', 'flexible', 'none'] },
        { field: 'effective_types', label: 'Effective Types', value_type: 'array', operators: ARRAY_OPS, values: ['physical', 'digital', 'hybrid', 'service'] },
        { field: 'allowed_types', label: 'Allowed Types', value_type: 'array', operators: ARRAY_OPS, values: ['physical', 'digital', 'hybrid', 'service'] },
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'fulfillment',
      label: 'Fulfillment',
      fields: [
        { field: 'shows_pickup', label: 'Shows Pickup', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_delivery', label: 'Shows Delivery', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_shipping', label: 'Shows Shipping', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_service', label: 'Shows Service', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_pickup', label: 'Effective Shows Pickup', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_delivery', label: 'Effective Shows Delivery', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_shipping', label: 'Effective Shows Shipping', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'commerce',
      label: 'Commerce',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'cart_visible', label: 'Cart Visible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_cart_visible', label: 'Effective Cart Visible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'checkout_available', label: 'Checkout Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'payment_type', label: 'Payment Type', value_type: 'string', operators: STRING_OPS, values: ['full', 'deposit', 'flexible', 'none'] },
        { field: 'effective_payment_type', label: 'Effective Payment Type', value_type: 'string', operators: STRING_OPS, values: ['full', 'deposit', 'flexible', 'none'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'payment_gateway',
      label: 'Payment Gateway',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_gateways', label: 'Allowed Gateways', value_type: 'array', operators: ARRAY_OPS, values: ['stripe', 'paypal', 'square', 'clover'] },
        { field: 'effective_gateways', label: 'Effective Gateways', value_type: 'array', operators: ARRAY_OPS, values: ['stripe', 'paypal', 'square', 'clover'] },
        { field: 'checkout_available', label: 'Checkout Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'product_options',
      label: 'Product Options',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_types', label: 'Allowed Types', value_type: 'array', operators: ARRAY_OPS, values: ['physical', 'digital', 'hybrid', 'service'] },
        { field: 'effective_types', label: 'Effective Types', value_type: 'array', operators: ARRAY_OPS, values: ['physical', 'digital', 'hybrid', 'service'] },
        { field: 'creation_enabled', label: 'Creation Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_variants', label: 'Shows Variants', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_gallery', label: 'Shows Gallery', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_video', label: 'Shows Video', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_variants', label: 'Effective Shows Variants', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_gallery', label: 'Effective Shows Gallery', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_video', label: 'Effective Shows Video', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'layout_enabled', label: 'Layout Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_layouts', label: 'Allowed Layouts', value_type: 'array', operators: ARRAY_OPS, values: ['classic', 'editorial', 'immersive'] },
        { field: 'effective_layout', label: 'Effective Layout', value_type: 'string', operators: STRING_OPS, values: ['classic', 'editorial', 'immersive'] },
        { field: 'sections_enabled', label: 'Sections Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_recently_viewed', label: 'Shows Recently Viewed', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_qr_codes', label: 'Shows QR Codes', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_recommended', label: 'Shows Recommended', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_map_display', label: 'Shows Map Display', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_reviews', label: 'Shows Reviews', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'shows_categories', label: 'Shows Categories', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_recently_viewed', label: 'Effective Shows Recently Viewed', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_qr_codes', label: 'Effective Shows QR Codes', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_recommended', label: 'Effective Shows Recommended', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_map_display', label: 'Effective Shows Map Display', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_reviews', label: 'Effective Shows Reviews', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_shows_categories', label: 'Effective Shows Categories', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'featured',
      label: 'Featured',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_types', label: 'Allowed Types', value_type: 'array', operators: ARRAY_OPS, values: ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured', 'bestseller', 'trending', 'recommended', 'random_featured'] },
        { field: 'effective_types', label: 'Effective Types', value_type: 'array', operators: ARRAY_OPS, values: ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured', 'bestseller', 'trending', 'recommended', 'random_featured'] },
        { field: 'featured_available', label: 'Featured Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_featured_available', label: 'Effective Featured Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'expiry_monitor_enabled', label: 'Expiry Monitor Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'integrations',
      label: 'Integrations',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'pos_enabled', label: 'POS Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'google_enabled', label: 'Google Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_types', label: 'Allowed Types', value_type: 'array', operators: ARRAY_OPS, values: ['clover', 'square', 'gbp', 'google_shopping', 'google_merchant_center', 'gmc_sync', 'propagation_gbp'] },
        { field: 'effective_types', label: 'Effective Types', value_type: 'array', operators: ARRAY_OPS, values: ['clover', 'square', 'gbp', 'google_shopping', 'google_merchant_center', 'gmc_sync', 'propagation_gbp'] },
        { field: 'integrations_available', label: 'Integrations Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'quickstart',
      label: 'Quickstart',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'product_enabled', label: 'Product Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'category_enabled', label: 'Category Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'ai_enabled', label: 'AI Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_wizard', label: 'Can Use Wizard', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_ai_wizard', label: 'Can Use AI Wizard', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_category_generator', label: 'Can Use Category Generator', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_generate_images', label: 'Can Generate Images', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_openai', label: 'Can Use OpenAI', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_gemini', label: 'Can Use Gemini', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_hd_images', label: 'Can Use HD Images', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'storefront_options',
      label: 'Storefront Options',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'hours_enabled', label: 'Hours Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'category_enabled', label: 'Category Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'recommend_enabled', label: 'Recommend Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'recently_viewed_enabled', label: 'Recently Viewed Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'info_enabled', label: 'Info Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'qr_enabled', label: 'QR Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'gallery_enabled', label: 'Gallery Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'advanced_enabled', label: 'Advanced Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'layout_enabled', label: 'Layout Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_layout', label: 'Effective Layout', value_type: 'string', operators: STRING_OPS, values: ['classic', 'editorial', 'immersive'] },
        { field: 'can_show_hours_display', label: 'Can Show Hours Display', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_animated_hours', label: 'Can Use Animated Hours', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_map_display', label: 'Can Show Map Display', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_category_store', label: 'Can Use Category Store', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_category_product', label: 'Can Use Category Product', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_qr_codes', label: 'Can Use QR Codes', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_enhanced_seo', label: 'Can Use Enhanced SEO', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'directory_entry',
      label: 'Directory Entry',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'layout_enabled', label: 'Layout Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_layout', label: 'Effective Layout', value_type: 'string', operators: STRING_OPS, values: ['classic', 'editorial', 'immersive', 'premium'] },
        { field: 'hours_enabled', label: 'Hours Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'map_enabled', label: 'Map Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'contact_enabled', label: 'Contact Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'gallery_enabled', label: 'Gallery Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'qr_enabled', label: 'QR Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'social_enabled', label: 'Social Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'seo_enabled', label: 'SEO Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_hours', label: 'Can Show Hours', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_map', label: 'Can Show Map', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_contact', label: 'Can Show Contact', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_gallery', label: 'Can Show Gallery', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_qr', label: 'Can Show QR', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_social', label: 'Can Show Social', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_show_seo', label: 'Can Show SEO', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'faq',
      label: 'FAQ',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'storefront_enabled', label: 'Storefront Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'product_enabled', label: 'Product Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'templates_enabled', label: 'Templates Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'management_enabled', label: 'Management Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'preview_enabled', label: 'Preview Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'display_enabled', label: 'Display Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'kb_enabled', label: 'KB Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'faq_available', label: 'FAQ Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'crm',
      label: 'CRM',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'inquiry_product_enabled', label: 'Inquiry Product Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'inquiry_storefront_enabled', label: 'Inquiry Storefront Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'inquiry_directory_enabled', label: 'Inquiry Directory Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'contacts_enabled', label: 'Contacts Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'ticket_features_enabled', label: 'Ticket Features Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'message_features_enabled', label: 'Message Features Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'customer_tickets_enabled', label: 'Customer Tickets Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'dashboard_enabled', label: 'Dashboard Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'crm_available', label: 'CRM Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'chatbot',
      label: 'Chatbot',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'static_enabled', label: 'Static Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'dynamic_enabled', label: 'Dynamic Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'skills_enabled', label: 'Skills Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'kb_enabled', label: 'KB Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'widget_enabled', label: 'Widget Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'chatbot_available', label: 'Chatbot Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_widget_custom_theme', label: 'Can Use Widget Custom Theme', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_widget_skill_cards', label: 'Can Use Widget Skill Cards', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_widget_after_hours', label: 'Can Use Widget After Hours', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'barcode_scan',
      label: 'Barcode Scan',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_modes', label: 'Allowed Modes', value_type: 'array', operators: ARRAY_OPS, values: ['scan', 'manual', 'usb', 'camera'] },
        { field: 'effective_modes', label: 'Effective Modes', value_type: 'array', operators: ARRAY_OPS, values: ['scan', 'manual', 'usb', 'camera'] },
        { field: 'scan_available', label: 'Scan Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'effective_scan_available', label: 'Effective Scan Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'org_options',
      label: 'Organization Options',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_tabs', label: 'Allowed Tabs', value_type: 'array', operators: ARRAY_OPS, values: ['overview', 'locations', 'propagation', 'capabilities', 'team', 'commerce', 'billing'] },
        { field: 'allowed_panels', label: 'Allowed Panels', value_type: 'array', operators: ARRAY_OPS, values: ['task_checklist', 'quick_links', 'system_status', 'recommendations', 'crm_summary'] },
        { field: 'allowed_propagation_types', label: 'Allowed Propagation Types', value_type: 'array', operators: ARRAY_OPS, values: ['org_propagation_products', 'org_propagation_categories', 'org_propagation_business_info', 'org_propagation_settings'] },
        { field: 'org_available', label: 'Org Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'social_commerce_options',
      label: 'Social Commerce Options',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'meta_enabled', label: 'Meta Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_meta_types', label: 'Allowed Meta Types', value_type: 'array', operators: ARRAY_OPS, values: ['social_commerce_meta_catalog', 'social_commerce_meta_shop', 'social_commerce_meta_pixel'] },
        { field: 'tiktok_enabled', label: 'TikTok Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_tiktok_types', label: 'Allowed TikTok Types', value_type: 'array', operators: ARRAY_OPS, values: ['social_commerce_tiktok_catalog', 'social_commerce_tiktok_shop', 'social_commerce_tiktok_pixel'] },
        { field: 'experience_enabled', label: 'Experience Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_experience_types', label: 'Allowed Experience Types', value_type: 'array', operators: ARRAY_OPS, values: ['social_commerce_share_buttons', 'social_commerce_social_proof', 'social_commerce_abandoned_cart'] },
        { field: 'can_use_meta_catalog', label: 'Can Use Meta Catalog', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_meta_shop', label: 'Can Use Meta Shop', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_tiktok_catalog', label: 'Can Use TikTok Catalog', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_tiktok_shop', label: 'Can Use TikTok Shop', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_share_buttons', label: 'Can Use Share Buttons', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_social_proof', label: 'Can Use Social Proof', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_use_abandoned_cart', label: 'Can Use Abandoned Cart', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'social_commerce_available', label: 'Social Commerce Available', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'directory_promotion',
      label: 'Directory Promotion',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'allowed_tiers', label: 'Allowed Tiers', value_type: 'array', operators: ARRAY_OPS, values: ['basic', 'premium', 'featured'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
    {
      key: 'wholesale_matching',
      label: 'Wholesale Matching',
      fields: [
        { field: 'enabled', label: 'Enabled', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'tier', label: 'Tier', value_type: 'string', operators: STRING_OPS, values: ['none', 'search', 'full'] },
        { field: 'can_check_supplier_match', label: 'Can Check Supplier Match', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_search_faire', label: 'Can Search Faire', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_build_affiliate_link', label: 'Can Build Affiliate Link', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'can_view_brand_partners', label: 'Can View Brand Partners', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
        { field: 'is_flexible', label: 'Is Flexible', value_type: 'boolean', operators: BOOL_OPS, values: ['true', 'false'] },
      ],
    },
  ],
  operators: ['equals', 'includes', 'not_includes', 'is_true', 'is_false'],
  types: ['requires', 'recommends', 'excludes', 'implies'],
  severities: ['block', 'warn', 'info'],
};

const constraintSchema = z.object({
  constraint_id: z.string().min(1),
  type: z.enum(['requires', 'recommends', 'excludes', 'implies']),
  severity: z.enum(['block', 'warn', 'info']),
  source_capability: z.string().min(1),
  source_field: z.string().min(1),
  source_operator: z.enum(['equals', 'includes', 'not_includes', 'is_true', 'is_false']),
  source_value: z.string(),
  target_capability: z.string().min(1),
  target_field: z.string().min(1),
  target_operator: z.enum(['equals', 'includes', 'not_includes', 'is_true', 'is_false']),
  target_value: z.string(),
  message: z.string().min(1),
  resolution_hint: z.string().min(1),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

// GET /api/admin/capability-constraints — list all constraints
router.get('/', async (_req, res) => {
  try {
    const constraints = await prisma.capability_constraints_list.findMany({
      orderBy: { sort_order: 'asc' },
    });
    res.json(constraints);
  } catch (error) {
    console.error('Error fetching capability constraints:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch constraints' });
  }
});

// GET /api/admin/capability-constraints/metadata — get valid capability keys, fields, and values for constraint form dropdowns
router.get('/metadata', (_req, res) => {
  try {
    res.json(CONSTRAINT_METADATA);
  } catch (error) {
    console.error('Error fetching constraint metadata:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch constraint metadata' });
  }
});

// GET /api/admin/capability-constraints/:id — get single constraint
router.get('/:id', async (req, res) => {
  try {
    const constraint = await prisma.capability_constraints_list.findUnique({
      where: { id: req.params.id },
    });
    if (!constraint) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }
    res.json(constraint);
  } catch (error) {
    console.error('Error fetching constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch constraint' });
  }
});

// POST /api/admin/capability-constraints — create new constraint
router.post('/', async (req, res) => {
  try {
    const parsed = constraintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid constraint data', details: parsed.error.issues });
    }

    const constraint = await prisma.capability_constraints_list.create({
      data: {
        constraint_id: parsed.data.constraint_id,
        type: parsed.data.type,
        severity: parsed.data.severity,
        source_capability: parsed.data.source_capability,
        source_field: parsed.data.source_field,
        source_operator: parsed.data.source_operator,
        source_value: parsed.data.source_value,
        target_capability: parsed.data.target_capability,
        target_field: parsed.data.target_field,
        target_operator: parsed.data.target_operator,
        target_value: parsed.data.target_value,
        message: parsed.data.message,
        resolution_hint: parsed.data.resolution_hint,
        is_active: parsed.data.is_active,
        sort_order: parsed.data.sort_order,
      },
    });

    invalidateConstraintCache();
    res.status(201).json(constraint);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'duplicate', message: 'Constraint ID already exists' });
    }
    console.error('Error creating constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create constraint' });
  }
});

// PUT /api/admin/capability-constraints/:id — update constraint
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.capability_constraints_list.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }

    const updateSchema = constraintSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid constraint data', details: parsed.error.issues });
    }

    const constraint = await prisma.capability_constraints_list.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        updated_at: new Date(),
      },
    });

    invalidateConstraintCache();
    res.json(constraint);
  } catch (error) {
    console.error('Error updating constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update constraint' });
  }
});

// DELETE /api/admin/capability-constraints/:id — delete constraint
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.capability_constraints_list.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }

    await prisma.capability_constraints_list.delete({ where: { id: req.params.id } });
    invalidateConstraintCache();
    res.json({ message: 'Constraint deleted' });
  } catch (error) {
    console.error('Error deleting constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to delete constraint' });
  }
});

export default router;
