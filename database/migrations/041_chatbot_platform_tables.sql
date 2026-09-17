-- Migration: Chatbot Platform Tables
-- Description: Create 10 bot tables + tenant_chatbot_options_settings for Phase 1A
--              + bot_faq_embeddings for Phase 3A (requires pgvector)
-- Run manually on staging AND production via SQL editor
-- Date: 2026-06-18

-- Required for Phase 3A bot_faq_embeddings table
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. bot_configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    bot_name VARCHAR(100) NOT NULL DEFAULT 'Store Assistant',
    tone VARCHAR(20) NOT NULL DEFAULT 'friendly',
    response_length VARCHAR(20) NOT NULL DEFAULT 'balanced',
    fallback_message TEXT NOT NULL DEFAULT 'I''m not sure about that. Let me connect you with support.',
    greeting TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',

    widget_position VARCHAR(20) NOT NULL DEFAULT 'bottom-right',
    widget_color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    widget_offset_x INT NOT NULL DEFAULT 24,
    widget_offset_y INT NOT NULL DEFAULT 24,
    widget_font VARCHAR(50) NOT NULL DEFAULT 'system-ui',
    widget_avatar_url VARCHAR(500),

    auto_open BOOLEAN NOT NULL DEFAULT false,
    auto_open_delay INT NOT NULL DEFAULT 0,

    after_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    after_hours_message TEXT,
    business_hours_source VARCHAR(20) NOT NULL DEFAULT 'business_profile',

    pre_chat_enabled BOOLEAN NOT NULL DEFAULT false,
    pre_chat_email BOOLEAN NOT NULL DEFAULT true,
    pre_chat_phone BOOLEAN NOT NULL DEFAULT false,
    pre_chat_order BOOLEAN NOT NULL DEFAULT false,

    status VARCHAR(20) NOT NULL DEFAULT 'active',
    escalation_enabled BOOLEAN NOT NULL DEFAULT false,
    escalation_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. bot_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    source VARCHAR(20) NOT NULL DEFAULT 'widget',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    resolved_by VARCHAR(20),
    page_context VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_conversations_tenant_created
ON bot_conversations(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_session_id
ON bot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_status
ON bot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_tenant_status
ON bot_conversations(tenant_id, status);

-- ============================================================
-- 3. bot_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES bot_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    intent VARCHAR(50),
    confidence FLOAT,
    matched_faq_id UUID,
    response_type VARCHAR(20) NOT NULL DEFAULT 'static',
    guardrail_result VARCHAR(20),
    skill_name VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_conversation_created
ON bot_messages(conversation_id, created_at);

-- ============================================================
-- 4. bot_conversation_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_conversation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES bot_conversations(id) ON DELETE CASCADE,
    rating VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_feedback_message_id
ON bot_conversation_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversation_feedback_conversation_id
ON bot_conversation_feedback(conversation_id);

-- ============================================================
-- 5. bot_guardrail_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_guardrail_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    rule_type VARCHAR(50) NOT NULL,
    pattern VARCHAR(500) NOT NULL,
    action VARCHAR(20) NOT NULL DEFAULT 'block',
    replacement VARCHAR(255),
    response_template TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_guardrail_rules_tenant_active
ON bot_guardrail_rules(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bot_guardrail_rules_rule_type
ON bot_guardrail_rules(rule_type);

-- ============================================================
-- 6. bot_intents
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    examples VARCHAR(255)[] NOT NULL DEFAULT '{}',
    confidence_threshold FLOAT NOT NULL DEFAULT 0.85,
    mapped_skill VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_intents_category
ON bot_intents(category);

-- ============================================================
-- 7. bot_skills
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    version VARCHAR(10) NOT NULL DEFAULT '1.0.0',
    description TEXT,
    endpoint VARCHAR(255) NOT NULL,
    required_capabilities VARCHAR(50)[] NOT NULL DEFAULT '{}',
    tier_gates VARCHAR(20)[] NOT NULL DEFAULT '{}',
    capability_gates VARCHAR(50)[] NOT NULL DEFAULT '{}',
    tenant_status_gates VARCHAR(20)[] NOT NULL DEFAULT '{}',
    featured_aware BOOLEAN NOT NULL DEFAULT false,
    refresh_cadence_minutes INT NOT NULL DEFAULT 15,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    skill_card_schema JSONB,
    default_config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. bot_skill_configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_skill_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    skill_id UUID NOT NULL REFERENCES bot_skills(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_skill_configurations_tenant_id
ON bot_skill_configurations(tenant_id);

-- ============================================================
-- 9. tenant_chatbot_options_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_chatbot_options_settings (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    chatbot_enabled BOOLEAN DEFAULT true,
    chatbot_static_enabled BOOLEAN DEFAULT true,
    chatbot_dynamic_enabled BOOLEAN DEFAULT false,
    chatbot_skills_enabled BOOLEAN DEFAULT false,
    chatbot_kb_enabled BOOLEAN DEFAULT false,
    chatbot_widget_enabled BOOLEAN DEFAULT true,
    chatbot_widget_custom_theme BOOLEAN DEFAULT false,
    chatbot_widget_skill_cards BOOLEAN DEFAULT false,
    chatbot_widget_after_hours BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_options_tenant
ON tenant_chatbot_options_settings(tenant_id);

-- ============================================================
-- updated_at triggers (for tables with updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION update_bot_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_configurations_updated_at ON bot_configurations;
CREATE TRIGGER bot_configurations_updated_at
BEFORE UPDATE ON bot_configurations
FOR EACH ROW EXECUTE FUNCTION update_bot_configurations_updated_at();

CREATE OR REPLACE FUNCTION update_bot_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_conversations_updated_at ON bot_conversations;
CREATE TRIGGER bot_conversations_updated_at
BEFORE UPDATE ON bot_conversations
FOR EACH ROW EXECUTE FUNCTION update_bot_conversations_updated_at();

CREATE OR REPLACE FUNCTION update_bot_guardrail_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_guardrail_rules_updated_at ON bot_guardrail_rules;
CREATE TRIGGER bot_guardrail_rules_updated_at
BEFORE UPDATE ON bot_guardrail_rules
FOR EACH ROW EXECUTE FUNCTION update_bot_guardrail_rules_updated_at();

CREATE OR REPLACE FUNCTION update_bot_intents_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_intents_updated_at ON bot_intents;
CREATE TRIGGER bot_intents_updated_at
BEFORE UPDATE ON bot_intents
FOR EACH ROW EXECUTE FUNCTION update_bot_intents_updated_at();

CREATE OR REPLACE FUNCTION update_bot_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_skills_updated_at ON bot_skills;
CREATE TRIGGER bot_skills_updated_at
BEFORE UPDATE ON bot_skills
FOR EACH ROW EXECUTE FUNCTION update_bot_skills_updated_at();

CREATE OR REPLACE FUNCTION update_bot_skill_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_skill_configurations_updated_at ON bot_skill_configurations;
CREATE TRIGGER bot_skill_configurations_updated_at
BEFORE UPDATE ON bot_skill_configurations
FOR EACH ROW EXECUTE FUNCTION update_bot_skill_configurations_updated_at();

CREATE OR REPLACE FUNCTION update_tenant_chatbot_options_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_chatbot_options_settings_updated_at ON tenant_chatbot_options_settings;
CREATE TRIGGER tenant_chatbot_options_settings_updated_at
BEFORE UPDATE ON tenant_chatbot_options_settings
FOR EACH ROW EXECUTE FUNCTION update_tenant_chatbot_options_settings_updated_at();

-- ============================================================
-- bot_faq_embeddings (Phase 3A — RAG with pgvector)
-- ============================================================
-- Requires pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS bot_faq_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  faq_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding vector(1536),
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bot_faq_embeddings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_faq_embeddings_faq FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_faq_embeddings_tenant ON bot_faq_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_faq_embeddings_faq ON bot_faq_embeddings(faq_id);
CREATE INDEX IF NOT EXISTS idx_bot_faq_embeddings_tenant_faq ON bot_faq_embeddings(tenant_id, faq_id);

-- Vector similarity index (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_bot_faq_embeddings_vector
  ON bot_faq_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- bot_product_embeddings (Phase 3A-ext — product catalog RAG with pgvector)
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_product_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536),
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bot_product_embeddings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_product_embeddings_inventory_item FOREIGN KEY (product_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_product_embeddings_tenant ON bot_product_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_product_embeddings_product ON bot_product_embeddings(product_id);
CREATE INDEX IF NOT EXISTS idx_bot_product_embeddings_tenant_product ON bot_product_embeddings(tenant_id, product_id);

-- Vector similarity index (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_bot_product_embeddings_vector
  ON bot_product_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON TABLE bot_configurations IS 'Per-tenant bot configuration (name, tone, widget settings, status)';
COMMENT ON TABLE bot_conversations IS 'Bot conversation sessions with 24h expiry, archival support';
COMMENT ON TABLE bot_messages IS 'Individual messages in bot conversations (user, assistant, system)';
COMMENT ON TABLE bot_conversation_feedback IS 'Thumbs up/down feedback on bot messages';
COMMENT ON TABLE bot_guardrail_rules IS 'Safety rules (banned phrases, PII, moderation). tenant_id NULL = global rule';
COMMENT ON TABLE bot_intents IS 'Intent taxonomy with keyword examples for Phase 1A matching';
COMMENT ON TABLE bot_skills IS 'Skill registry with tier/capability gates and execution endpoints';
COMMENT ON TABLE bot_skill_configurations IS 'Per-tenant skill overrides (enable/disable, config)';
COMMENT ON TABLE tenant_chatbot_options_settings IS 'Merchant preference toggles for chatbot capability';
COMMENT ON TABLE bot_faq_embeddings IS 'FAQ chunk embeddings for RAG similarity search (Phase 3A, requires pgvector)';
COMMENT ON TABLE bot_product_embeddings IS 'Product catalog chunk embeddings for RAG similarity search (Phase 3A-ext, requires pgvector)';
