'use client';

import { Cpu } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';

/**
 * AuditImportMetadataBadge — renders the import_metadata recorded on an
 * externally-imported audit (which AI model produced it).
 *
 * Renders nothing when the audit has no import_metadata, so it is safe to
 * drop into any audit card header. When metadata is present, shows a compact
 * badge with the model + provider (and a title tooltip with the full metadata
 * including run_id and notes).
 */
export default function AuditImportMetadataBadge({ audit }: { audit: Audit }) {
  const meta = audit.import_metadata;
  if (!meta || typeof meta !== 'object') return null;

  const model = meta.model;
  const provider = meta.provider;
  const runId = meta.run_id;
  const notes = meta.notes;

  // Build the visible label: prefer "model" alone, fall back to provider,
  // or combine both. If neither is present, show "Imported" as a fallback
  // only if there's any other metadata worth showing (run_id / notes).
  const parts: string[] = [];
  if (model) parts.push(String(model));
  if (provider) parts.push(String(provider));
  if (parts.length === 0 && (runId || notes)) parts.push('Imported');
  if (parts.length === 0) return null;

  // Tooltip with full metadata for at-a-glance disambiguation.
  const tooltipParts: string[] = [];
  if (model) tooltipParts.push(`Model: ${model}`);
  if (provider) tooltipParts.push(`Provider: ${provider}`);
  if (runId) tooltipParts.push(`Run ID: ${runId}`);
  if (notes) tooltipParts.push(`Notes: ${notes}`);
  const tooltip = tooltipParts.join(' · ');

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
    >
      <Cpu className="h-2.5 w-2.5" />
      {parts.join(' · ')}
    </span>
  );
}
