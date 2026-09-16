'use client';

/**
 * Shared Construction Variables store for the openers workspace.
 *
 * The Manual tab (producer lane) and the Pitch Construction tab both surface
 * the same `{{placeholders}}` (business, operator/sender name, …). Without a
 * shared store the operator retypes the same values on each tab. This module
 * keeps one per-campaign map in localStorage that both tabs read/write, so a
 * value entered on either tab is visible on the other.
 *
 * It is intentionally client-only + temporary (localStorage, per campaign) —
 * the Manual tab's doc `fields` jsonb remains the server-persisted copy that
 * promotion consumes; this store is the cross-tab bridge.
 *
 * Key bridging: the two tabs use slightly different placeholder names for the
 * same person (Pitch starters use `{{name}}`; Manual copy uses
 * `{{operator_name}}`/`{{sender_name}}`). VAR_ALIASES lets a value entered
 * under one key resolve under the other so the operator still types it once.
 */

import { useCallback, useEffect, useState } from 'react';

const STORE_PREFIX = 'mkt:openers:construction-vars:';

/** Cross-tab key bridges (canonical key → fallback keys to read from). */
const VAR_ALIASES: Record<string, string[]> = {
  name: ['operator_name', 'sender_name'],
  operator_name: ['name', 'sender_name'],
  sender_name: ['operator_name', 'name'],
};

function storageKey(campaignId: string): string {
  return `${STORE_PREFIX}${campaignId}`;
}

/** Read the shared store for a campaign. Never throws (private mode/quota). */
export function readConstructionVars(campaignId: string): Record<string, string> {
  if (typeof window === 'undefined' || !campaignId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(campaignId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeConstructionVars(campaignId: string, vars: Record<string, string>): void {
  if (typeof window === 'undefined' || !campaignId) return;
  try {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === 'string' && v.trim()) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      window.localStorage.removeItem(storageKey(campaignId));
    } else {
      window.localStorage.setItem(storageKey(campaignId), JSON.stringify(cleaned));
    }
  } catch {
    // Quota exceeded / storage disabled — non-fatal.
  }
}

/**
 * Resolve a var's value from the store, falling back to alias keys so a value
 * entered under `operator_name` also resolves `{{name}}` (and vice versa).
 * Returns undefined when nothing usable is stored.
 */
export function resolveVar(vars: Record<string, string>, key: string): string | undefined {
  const direct = vars[key];
  if (direct && direct.trim()) return direct;
  for (const alias of VAR_ALIASES[key] ?? []) {
    const v = vars[alias];
    if (v && v.trim()) return v;
  }
  return undefined;
}

export interface UseConstructionVariables {
  vars: Record<string, string>;
  setVar: (key: string, value: string) => void;
  /** Patch multiple keys at once; an empty/undefined value deletes the key. */
  setVars: (patch: Record<string, string | undefined>) => void;
}

/**
 * Hook over the shared per-campaign store. Re-reads whenever the campaign
 * changes so switching campaigns never leaks another campaign's values.
 */
export function useConstructionVariables(campaignId: string): UseConstructionVariables {
  const [vars, setVarsState] = useState<Record<string, string>>({});

  useEffect(() => {
    setVarsState(readConstructionVars(campaignId));
  }, [campaignId]);

  const commit = useCallback(
    (mutate: (prev: Record<string, string>) => Record<string, string>) => {
      setVarsState((prev) => {
        const next = mutate(prev);
        writeConstructionVars(campaignId, next);
        return next;
      });
    },
    [campaignId],
  );

  const setVar = useCallback(
    (key: string, value: string) => {
      commit((prev) => {
        const next = { ...prev };
        if (value === '') delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [commit],
  );

  const setVars = useCallback(
    (patch: Record<string, string | undefined>) => {
      commit((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          if (!v) delete next[k];
          else next[k] = v;
        }
        return next;
      });
    },
    [commit],
  );

  return { vars, setVar, setVars };
}
