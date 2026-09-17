-- Migration 233: Prompt Execution Error Message
--
-- Stores the error message when a prompt execution fails (AI call error,
-- invalid JSON output, schema validation failure). Without this, the
-- executions list shows status='failed' with no explanation, leaving the
-- operator unable to diagnose why a run failed.
--
-- Populated by:
--   - MarketingExecutionService.executeSingle (AI call failure)
--   - ProfileRepairPromptService.importExternalResult (JSON parse / schema)
--   - ProfileRepairPromptService.runResolution (JSON parse failure)
--
-- Nullable; only set on failure. Cleared implicitly on retry (a new
-- execution row is created rather than reusing the failed one).

ALTER TABLE mkt_prompt_executions_list
  ADD COLUMN IF NOT EXISTS error_message TEXT;
