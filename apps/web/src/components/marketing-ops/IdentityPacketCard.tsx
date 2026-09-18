'use client';

/**
 * IdentityPacketCard — source-scored Identity Packet for a business-scope
 * campaign.
 *
 * Renders the evidence ledger behind the seed decision: per-field scores, the
 * source ledger with authority tiers, hard vetoes, QC signals, and a
 * Push/Wait recommendation. The operator decides — Push creates the DRAFT seed
 * (publish stays a separate, human step); Wait acknowledges the packet without
 * seeding.
 *
 * The ledger is derived from audits and seed provenance, so a business with no
 * audit yet reads 0 on both axes. "Add evidence" is the operator write path
 * (mkt_identity_evidence): record a source as it becomes available — a call
 * with the owner, a GBP page, the SNAP retailer list — and the packet
 * re-scores. Rows are shared across the business prospect's sibling campaigns,
 * and owner contact captured on a row is reused for owner outreach.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  RefreshCw,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ArrowUpRight,
  PauseCircle,
  Trash2,
} from 'lucide-react';
import directoryPresenceAdminService, {
  type IdentityPacket,
  type IdentityRecommendationBand,
  type IdentitySourceTier,
} from '@/services/DirectoryPresenceAdminService';
import { IDENTITY_FIELD_LABELS, IDENTITY_EVIDENCE_STATE_LABELS, IDENTITY_TIER_LABELS } from '@/lib/identity-evidence';
import AddIdentityEvidenceModal from './AddIdentityEvidenceModal';

const TIER_LABEL: Record<IdentitySourceTier, string> = IDENTITY_TIER_LABELS;

const TIER_CLASS: Record<IdentitySourceTier, string> = {
  authoritative: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  first_party: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  major_aggregator: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  secondary_aggregator: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  inferred: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
};

const BAND_META: Record<IdentityRecommendationBand, { label: string; cls: string; blurb: string }> = {
  ready: {
    label: 'Ready to push',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    blurb: 'Identity is well-corroborated and the business reads as operating. Safe to push the draft seed.',
  },
  review: {
    label: 'Review',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    blurb: 'Identity is moderate. Resolve the QC signals below before pushing — or push and fix in QC.',
  },
  blocked: {
    label: 'Blocked',
    cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    blurb: 'A veto or weak identity blocks seeding. Verify by phone and re-audit before pushing.',
  },
};

const FIELD_LABEL: Record<string, string> = IDENTITY_FIELD_LABELS;

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function ScoreBox({ label, value, hint }: { label: string; value: number; hint: string }) {
  const tone =
    value >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : value >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}

export default function IdentityPacketCard({
  campaignId,
  onSeedCreated,
}: {
  campaignId: string;
  onSeedCreated?: () => void;
}) {
  const [packet, setPacket] = useState<IdentityPacket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [waited, setWaited] = useState(false);
  const [pushed, setPushed] = useState<{ publicUrl: string } | null>(null);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPacket(await directoryPresenceAdminService.getIdentityPacket(campaignId));
    } catch (e: any) {
      setError(e?.message || 'Failed to load identity packet');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const removeEvidence = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      const next = await directoryPresenceAdminService.removeIdentityEvidence(id, campaignId);
      if (next) setPacket(next);
      else await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove evidence');
    } finally {
      setRemovingId(null);
    }
  };

  const push = async () => {
    setPushing(true);
    setError(null);
    try {
      const r = await directoryPresenceAdminService.createSeedFromCampaign(campaignId, false);
      setPushed({ publicUrl: r.publicUrl });
      await load();
      onSeedCreated?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to create seed');
    } finally {
      setPushing(false);
    }
  };

  if (loading && !packet) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-6 text-sm text-gray-500 dark:text-gray-400">
        Assembling identity packet…
      </div>
    );
  }

  if (error && !packet) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-6">
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
        <button
          onClick={load}
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!packet) return null;

  const { score } = packet;
  const band = BAND_META[score.band];
  const blocked = score.vetoes.length > 0;
  const seed = packet.seed;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity Packet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {packet.businessName ?? 'Unknown business'} · {packet.ledger.length} source
              {packet.ledger.length === 1 ? '' : 's'} · generated {new Date(packet.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddEvidence(true)}
            className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <ShieldPlus className="h-3.5 w-3.5" /> Add evidence
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-neutral-600 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ScoreBox label="Identity score" value={score.identityScore} hint="Weakest-link over required fields" />
        <ScoreBox label="Operational recency" value={score.operationalScore} hint="Recent activity evidence" />
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Recommendation
          </div>
          <div className="mt-1.5">
            <Badge cls={band.cls}>{band.label}</Badge>
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{band.blurb}</div>
        </div>
      </div>

      {/* Vetoes */}
      {blocked && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Hard vetoes
          </div>
          <ul className="mt-1.5 space-y-1">
            {score.vetoes.map((v) => (
              <li key={v.code} className="text-xs text-red-700 dark:text-red-400">
                <span className="font-mono text-[10px] opacity-70">{v.code}</span> — {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QC signals */}
      {score.qcSignals.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Info className="h-3.5 w-3.5" /> QC signals
          </div>
          <ul className="mt-1.5 space-y-1">
            {score.qcSignals.map((s) => (
              <li key={s.code} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                <span
                  className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.severity === 'error' ? 'bg-red-500' : s.severity === 'warn' ? 'bg-amber-500' : 'bg-gray-400'
                  }`}
                />
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Push / Wait */}
      <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
        {seed ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-gray-700 dark:text-gray-200">
              Draft seed exists · <span className="font-medium">{seed.status}</span>
            </span>
            {seed.publicUrl && (
              <a
                href={seed.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                View listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : pushed ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Draft seed created.
            {pushed.publicUrl && (
              <a
                href={pushed.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                View listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={push}
              disabled={pushing || blocked}
              title={blocked ? 'Resolve the hard vetoes before seeding' : 'Create the draft seed'}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> {pushing ? 'Pushing…' : 'Push draft seed'}
            </button>
            <button
              onClick={() => setWaited(true)}
              disabled={waited}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-neutral-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <PauseCircle className="h-3.5 w-3.5" /> {waited ? 'Waiting' : 'Wait'}
            </button>
            {blocked && (
              <span className="text-xs text-red-600 dark:text-red-400">Blocked — resolve vetoes to enable Push.</span>
            )}
            {waited && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Marked as waiting. Resolve the QC signals, then push.
              </span>
            )}
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>}
      </div>

      {/* Field breakdown */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Field evidence
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="py-1.5 pr-3 font-semibold">Field</th>
                <th className="py-1.5 pr-3 font-semibold">Value</th>
                <th className="py-1.5 pr-3 font-semibold">Score</th>
                <th className="py-1.5 font-semibold">Sources</th>
              </tr>
            </thead>
            <tbody>
              {score.fields
                .filter((f) => f.value != null || f.sources.length > 0)
                .map((f) => (
                  <tr key={f.field} className="border-b border-gray-100 dark:border-neutral-800">
                    <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-200">
                      {FIELD_LABEL[f.field] ?? f.field}
                      {f.required && <span className="ml-1 text-[10px] text-red-500">required</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">{f.value ?? '—'}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={
                          f.score >= 80
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : f.score >= 50
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {f.score}
                      </span>
                      {f.conflictWeight > 0 && <span className="ml-1 text-[10px] text-red-500">conflict</span>}
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {f.sources.length === 0 && <span className="text-gray-400">none</span>}
                        {f.sources.map((s, i) => (
                          <Badge
                            key={`${s.name}-${i}`}
                            cls={s.agrees ? TIER_CLASS[s.tier] : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}
                          >
                            {s.name}
                            {s.manual && <span className="ml-1 opacity-70">·operator</span>}
                            {!s.agrees && ' ✕'}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source ledger */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Source ledger
        </h4>
        {packet.ledger.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No sources on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 pr-3 font-semibold">Source</th>
                  <th className="py-1.5 pr-3 font-semibold">Tier</th>
                  <th className="py-1.5 pr-3 font-semibold">Corroborates</th>
                  <th className="py-1.5 font-semibold">Accessed</th>
                </tr>
              </thead>
              <tbody>
                {packet.ledger.map((l, i) => (
                  <tr key={`${l.independenceGroup}-${l.name}-${i}`} className="border-b border-gray-100 dark:border-neutral-800">
                    <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-200">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          {l.name} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        l.name
                      )}
                      {l.manual && (
                        <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          operator
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge cls={TIER_CLASS[l.tier]}>{TIER_LABEL[l.tier]}</Badge>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">
                      {l.fields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}
                    </td>
                    <td className="py-1.5 text-gray-500 dark:text-gray-400">
                      {l.accessedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(l.accessedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operator evidence — the retractable half of the ledger. */}
      {packet.manualEvidence.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Operator evidence
            </h4>
            {packet.ownerContact && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Owner contact on file:{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {[packet.ownerContact.name, packet.ownerContact.phone, packet.ownerContact.email]
                    .filter(Boolean)
                    .join(' · ')}
                </span>{' '}
                — reused for owner outreach
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {packet.manualEvidence.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-neutral-700"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                    {e.sourceUrl ? (
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        {e.sourceName} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="font-medium">{e.sourceName}</span>
                    )}
                    <Badge cls={TIER_CLASS[e.tier]}>{TIER_LABEL[e.tier]}</Badge>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {IDENTITY_EVIDENCE_STATE_LABELS[e.evidenceState]}
                    </span>
                    {e.shared && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                        shared from sibling
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {e.corroborates.length > 0
                      ? e.corroborates.map((f) => FIELD_LABEL[f] ?? f).join(', ')
                      : 'owner contact only'}
                    {e.accessedAt && ` · accessed ${new Date(e.accessedAt).toLocaleDateString()}`}
                    {e.ownerName || e.ownerPhone || e.ownerEmail
                      ? ` · owner: ${[e.ownerName, e.ownerPhone, e.ownerEmail].filter(Boolean).join(' · ')}`
                      : ''}
                  </div>
                  {e.notes && <div className="mt-0.5 text-[11px] italic text-gray-500 dark:text-gray-400">{e.notes}</div>}
                </div>
                <button
                  onClick={() => removeEvidence(e.id)}
                  disabled={removingId === e.id}
                  title="Remove this source"
                  aria-label={`Remove ${e.sourceName}`}
                  className="mt-0.5 shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAddEvidence && (
        <AddIdentityEvidenceModal
          campaignId={campaignId}
          businessName={packet.businessName}
          onClose={() => setShowAddEvidence(false)}
          onAdded={setPacket}
        />
      )}
    </div>
  );
}
