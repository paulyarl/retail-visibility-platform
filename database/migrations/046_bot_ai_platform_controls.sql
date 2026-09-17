-- 046: Add bot AI controls to platform_settings_list
-- Allows platform admins to enable/disable the OpenAI-powered bot features
-- and the scheduled product embedding sync job, configure AI models,
-- sync frequency, and trigger manual syncs.

ALTER TABLE platform_settings_list
  ADD COLUMN IF NOT EXISTS bot_ai_enabled Boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS bot_embedding_sync_enabled Boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS bot_embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  ADD COLUMN IF NOT EXISTS bot_chat_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS bot_sync_interval_hours INT DEFAULT 12,
  ADD COLUMN IF NOT EXISTS bot_embedding_provider VARCHAR(20) DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS bot_chat_provider VARCHAR(20) DEFAULT 'openai';
