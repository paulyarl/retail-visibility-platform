-- Migration 308: Playbook preferences on mkt_signal_registry
-- Suggested signal promotion pre-wires triage intent: a registered signal can
-- declare a primary_playbook (the playbook whose `any` evidence pool the signal
-- joins — plug-and-play routing without editing matching_rules) and a
-- secondary_playbook (declared fallback when no playbook's rules match).
-- Nullable + additive — existing rows carry no preference and triage behavior
-- is unchanged until an operator wires one.

ALTER TABLE mkt_signal_registry
  ADD COLUMN IF NOT EXISTS primary_playbook varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS secondary_playbook varchar(20) NULL;
