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
import Link from 'next/link';
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
  Phone,
  Trash2,
} from 'lucide-react';
import directoryPresenceAdminService, {
  type IdentityPacket,
  type IdentityRecommendationBand,
  type IdentitySourceTier,
} from '@/services/DirectoryPresenceAdminService';
import { IDENTITY_FIELD_LABELS, IDENTITY_EVIDENCE_STATE_LABELS, IDENTITY_TIER_LABELS, sourceLabel } from '@/lib/identity-evidence';
import AddIdentityEvidenceModal from './AddIdentityEvidenceModal';
import ResolveVerificationModal, { type VerificationEntryLike } from './ResolveVerificationModal';

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
    blurb: 'A hard veto or weak identity is blocking this seed.',
  },
};

const FIELD_LABEL: Record<string, string> = IDENTITY_FIELD_LABELS;

/** Gate decision presentation (spec §2) — the server's verdict, not the band. */
const GATE_DECISION_META: Record<string, { label: string; cls: string; blurb: string }> = {
  guaranteed: {
    label: 'Guaranteed',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    blurb: 'Signal strength clears the bar on depth alone — a strong presence is enough.',
  },
  earned: {
    label: 'Earned',
    cls: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
    blurb: 'Two or more evidence dimensions are satisfied — breadth earns the seed.',
  },
  rescued: {
    label: 'Rescued by owner',
    cls: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
    blurb: 'Owner confirmation carried a record that was short of earning.',
  },
  blocked: {
    label: 'Blocked',
    cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    blurb: 'The record does not clear the seed gate yet.',
  },
};

const DIMENSION_LABEL: Record<string, string> = {
  operational: 'Operational',
  identity: 'Identity',
  category: 'Category',
  location: 'Location',
};

/** Human labels for gate blocker codes (veto codes + prerequisites). */
const BLOCKER_LABEL: Record<string, string> = {
  missing_required_field: 'A required field has no resolved value',
  required_field_conflict: 'A required field has a blocking source conflict',
  insufficient_dimensions: 'Fewer than 2 evidence dimensions have sources',
  no_operational_evidence: 'No proven recent activity',
};

/** Strength threshold that guarantees a seed — mirrors GUARANTEE_STRENGTH_THRESHOLD in identityScoring. */
const GATE_STRENGTH_BAR = 2;

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

/** Numeric tone for a 0-100 score, keyed to the same thresholds as the scorer. */
function scoreToneClass(value: number): string {
  return value >= 80
    ? 'text-emerald-600 dark:text-emerald-400'
    : value >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';
}

/**
 * A 0-100 axis score. `muted` neutralizes the color when a hard veto has
 * already blocked the seed — a green "92" sitting above a red "Blocked" reads
 * as healthy and contradicts the decision the operator is being asked to make.
 */
function ScoreBox({
  label,
  value,
  hint,
  muted = false,
}: {
  label: string;
  value: number;
  hint: string;
  muted?: boolean;
}) {
  const tone = muted ? 'text-gray-400 dark:text-gray-500' : scoreToneClass(value);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${tone}`}
        aria-label={`${label}: ${value} out of 100${muted ? ' — informational, a hard veto blocks seeding' : ''}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}

/**
 * Source chips for one field. Conflicting sources are always shown (they are
 * what the veto is about); agreeing sources collapse behind a "+N more" chip so
 * a 9-source field stays scannable instead of wrapping over four lines.
 */
function SourceChips({
  sources,
  tierClass,
}: {
  sources: Array<{ name: string; tier: IdentitySourceTier; agrees: boolean; manual?: boolean }>;
  tierClass: Record<IdentitySourceTier, string>;
}) {
  if (sources.length === 0) return <span className="text-gray-400">none</span>;
  const conflicts = sources.filter((s) => !s.agrees);
  const agreeing = sources.filter((s) => s.agrees);
  const MAX_VISIBLE = 3;
  const visible = agreeing.slice(0, MAX_VISIBLE);
  const hidden = agreeing.slice(MAX_VISIBLE);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {conflicts.map((s, i) => (
        <Badge key={`conflict-${s.name}-${i}`} cls="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {sourceLabel(s.name)}
          {s.manual && <span className="ml-1 opacity-70">·operator</span>}
          <span aria-hidden="true"> ✕</span>
          <span className="sr-only"> (conflicts with the resolved value)</span>
        </Badge>
      ))}
      {visible.map((s, i) => (
        <Badge key={`agree-${s.name}-${i}`} cls={tierClass[s.tier]}>
          {sourceLabel(s.name)}
          {s.manual && <span className="ml-1 opacity-70">·operator</span>}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <span
          className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-neutral-700 dark:text-gray-300"
          title={hidden.map((s) => sourceLabel(s.name)).join(', ')}
        >
          +{hidden.length} more
        </span>
      )}
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
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [pushed, setPushed] = useState<{ seedId: string; publicUrl: string; published: boolean } | null>(null);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
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
      // Guarded lane — the server evaluates the seed gate (spec §6).
      const r = await directoryPresenceAdminService.createSeedFromCampaign(campaignId, false, 'guarded');
      setPushed({ seedId: r.seedId, publicUrl: r.publicUrl, published: r.published });
      await load();
      onSeedCreated?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to create seed');
    } finally {
      setPushing(false);
    }
  };

  // Persisted seed decision — 'wait' is stored on the campaign (advisory only,
  // Push stays enabled) and survives reloads; clicking again clears it.
  const waited = packet?.seedDecision?.decision === 'wait';

  const toggleWait = async () => {
    setDecisionBusy(true);
    setError(null);
    try {
      const r = await directoryPresenceAdminService.setIdentityPacketDecision(
        campaignId,
        waited ? 'clear' : 'wait',
      );
      setPacket(r.packet);
    } catch (e: any) {
      setError(e?.message || 'Failed to record decision');
    } finally {
      setDecisionBusy(false);
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
  // The gate decision is the server's verdict (spec §2); the band is the
  // pre-gate fallback for packets scored before the gate existed.
  const gateMeta = score.gate ? GATE_DECISION_META[score.gate.decision] : band;
  const blocked = score.vetoes.length > 0;
  // The SERVER gate (spec §2) decides pushability — the client must agree, or
  // the button enables a Push the API will reject with 409. Fall back to the
  // veto check for a pre-gate packet (no `gate` field).
  const gateBlocked = score.gate ? score.gate.decision === 'blocked' : blocked;
  const gateBlockReason = (() => {
    if (!gateBlocked) return '';
    if (blocked) return 'Resolve the vetoes above to enable Push.';
    if (score.gate?.blockers.includes('no_operational_evidence'))
      return 'No recent activity evidence — verify the business is operating.';
    if (score.gate?.blockers.includes('insufficient_dimensions'))
      return 'Not enough evidence yet — add sources or verify the record to earn a seed.';
    return 'This seed is blocked.';
  })();
  const seed = packet.seed;
  const visibleFields = score.fields.filter((f) => f.value != null || f.sources.length > 0);

  // The record-verification modal is campaign-scoped here: it prefills from the
  // packet's canonical values and writes the campaign record. Reuses the queue
  // modal's field panels rather than a parallel component.
  const canonicalValue = (key: string) => packet.fields.find((f) => f.field === key)?.value ?? '';
  // Fields in conflict — a verification that CHANGES one of these clears a
  // conflict, so the modal requires a reason.
  const conflictFields = score.fields.filter((f) => f.conflictWeight > 0).map((f) => f.field);
  const verificationEntry: VerificationEntryLike = {
    id: campaignId,
    business_name: packet.businessName,
    category: canonicalValue('primary_category'),
    business_snapshot: {
      verified_nap: {
        name: canonicalValue('name'),
        address: canonicalValue('address'),
        phone: canonicalValue('phone'),
        website: canonicalValue('website'),
        category: canonicalValue('primary_category'),
        owner_name: packet.ownerContact?.name ?? '',
      },
    },
  };

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
            onClick={() => setShowVerify(true)}
            title="Record a verification call — writes the campaign record (canonical NAP + attributed owner evidence)"
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-neutral-600 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
          >
            <Phone className="h-3.5 w-3.5" /> Verify record
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
        <ScoreBox
          label="Identity score"
          value={score.identityScore}
          hint="Limited by the weakest required field"
          muted={blocked}
        />
        <ScoreBox
          label="Operational recency"
          value={score.operationalScore}
          hint="Evidence of recent activity"
          muted={blocked}
        />
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {score.gate ? 'Seed gate' : 'Recommendation'}
          </div>
          <div className="mt-1.5">
            <Badge cls={gateMeta.cls}>{gateMeta.label}</Badge>
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{gateMeta.blurb}</div>
        </div>
      </div>
      {blocked && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Scores are informational — a hard veto blocks seeding regardless of how high they read.
        </p>
      )}

      {/* Seed gate — dimensions, strength, owner axis (spec §2) */}
      {score.gate && (
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Gate dimensions
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {score.gate.satisfiedCount}/4 satisfied · strength {score.gate.totalStrength}/{GATE_STRENGTH_BAR}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {score.gate.dimensions.map((d) => (
              <span
                key={d.dimension}
                title={
                  d.satisfied
                    ? `${d.sourceCount} source${d.sourceCount === 1 ? '' : 's'} · strength ${d.strength}`
                    : 'No sources testify on this dimension yet'
                }
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  d.satisfied
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
                }`}
              >
                {d.satisfied ? '✓' : '·'} {DIMENSION_LABEL[d.dimension] ?? d.dimension}
                {d.satisfied && <span className="opacity-70">{d.strength}</span>}
              </span>
            ))}
            {/* Owner axis — sits above the four dimensions (spec §2) */}
            <span
              title="Owner confirmation can rescue a record short of earning — it never overrides a veto"
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                score.gate.ownerOverRule
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
              }`}
            >
              {score.gate.ownerOverRule ? '✓' : '·'} Owner
              {score.gate.ownerOverRule && <span className="opacity-70">rescue</span>}
            </span>
          </div>
          {/* Strength meter — dimension strength + supporting (activity) vs the guarantee bar */}
          <div className="mt-2.5">
            <div className="relative h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-700">
              {(() => {
                const scale = Math.max(GATE_STRENGTH_BAR, score.gate.totalStrength, 0.01);
                const dimPct = Math.min(100, (score.gate.dimensionStrength / scale) * 100);
                const supPct = Math.min(100 - dimPct, (score.gate.supportingStrength / scale) * 100);
                const barPct = (GATE_STRENGTH_BAR / scale) * 100;
                return (
                  <>
                    <div className="absolute left-0 top-0 h-full bg-blue-500" style={{ width: `${dimPct}%` }} />
                    <div className="absolute top-0 h-full bg-sky-300 dark:bg-sky-500/60" style={{ left: `${dimPct}%`, width: `${supPct}%` }} />
                    <div
                      className="absolute top-0 h-full w-0.5 bg-gray-800 dark:bg-gray-200"
                      style={{ left: `${barPct}%` }}
                      title={`Guarantee bar at ${GATE_STRENGTH_BAR}`}
                    />
                  </>
                );
              })()}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              <span><span className="text-blue-500">■</span> presence {score.gate.dimensionStrength}</span>
              <span><span className="text-sky-400">■</span> activity {score.gate.supportingStrength}</span>
              <span>bar {GATE_STRENGTH_BAR} — depth alone can seed</span>
            </div>
          </div>
          {score.gate.blockers.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {score.gate.blockers.map((b) => (
                <li key={b} className="text-[11px] text-red-600 dark:text-red-400">
                  {BLOCKER_LABEL[b] ?? b}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Vetoes */}
      {blocked && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Hard vetoes
          </div>
          <ul className="mt-1.5 space-y-1">
            {score.vetoes.map((v, i) => (
              <li key={`${v.code}-${i}`} className="text-xs text-red-700 dark:text-red-400">
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
            {score.qcSignals.map((s, i) => (
              <li key={`${s.code}-${i}`} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                <span
                  className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.severity === 'error' ? 'bg-red-500' : s.severity === 'warn' ? 'bg-amber-500' : 'bg-gray-400'
                  }`}
                />
                <span>
                  {s.field && (
                    <span className="mr-1 rounded bg-amber-100/70 px-1 text-[10px] font-medium dark:bg-amber-900/40">
                      {FIELD_LABEL[s.field] ?? s.field}
                    </span>
                  )}
                  {s.message}
                </span>
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
              Seed exists · <span className="font-medium">{seed.status}</span>
            </span>
            <Link
              href={`/settings/admin/directory/presence-seeds/${seed.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View seed <ArrowUpRight className="h-3 w-3" />
            </Link>
            {seed.publicUrl && ['published', 'invited', 'claimed'].includes(seed.status) && (
              <a
                href={seed.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
              >
                View listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : pushed ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Draft seed created.
            <Link
              href={`/settings/admin/directory/presence-seeds/${pushed.seedId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View seed <ArrowUpRight className="h-3 w-3" />
            </Link>
            {pushed.published && pushed.publicUrl && (
              <a
                href={pushed.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
              >
                View listing <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={push}
              disabled={pushing || gateBlocked}
              title={gateBlocked ? gateBlockReason : 'Create the draft seed'}
              aria-disabled={pushing || gateBlocked}
              aria-describedby={gateBlocked ? 'identity-push-blocked' : undefined}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> {pushing ? 'Pushing…' : 'Push draft seed'}
            </button>
            <button
              onClick={toggleWait}
              disabled={decisionBusy}
              title={waited ? 'Clear the recorded wait decision' : 'Record a wait decision on this campaign'}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-neutral-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <PauseCircle className="h-3.5 w-3.5" /> {waited ? 'Waiting' : 'Wait'}
            </button>
            {gateBlocked && (
              <span id="identity-push-blocked" className="text-xs text-red-600 dark:text-red-400">
                {gateBlockReason}
              </span>
            )}
            {waited && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Waiting recorded
                {packet?.seedDecision?.at ? ` ${new Date(packet.seedDecision.at).toLocaleDateString()}` : ''}
                {' '}— not seeding yet. The packet re-scores as you add evidence or resolve vetoes.
              </span>
            )}
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>}
      </div>

      {/* Field breakdown */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Field evidence
          </h4>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Chips are sources; a red <span className="text-red-500">✕</span> source conflicts with the resolved value.
          </p>
        </div>
        {visibleFields.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No field evidence yet — use <span className="font-medium">Add evidence</span> to record a source.
          </p>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Field</th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Value</th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Score</th>
                    <th scope="col" className="py-1.5 font-semibold">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFields.map((f) => {
                    const conflicted = f.conflictWeight > 0;
                    return (
                      <tr key={f.field} className="border-b border-gray-100 dark:border-neutral-800">
                        <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-200">
                          {FIELD_LABEL[f.field] ?? f.field}
                          {f.required && <span className="ml-1 text-[10px] text-red-500">required</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">{f.value ?? '—'}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          <span
                            className={conflicted ? 'text-amber-600 dark:text-amber-400' : scoreToneClass(f.score)}
                            title={conflicted ? 'Conflicting sources lower the effective score' : undefined}
                          >
                            {f.score}
                          </span>
                          {conflicted && <span className="ml-1 text-[10px] text-red-500">conflict</span>}
                        </td>
                        <td className="py-1.5">
                          <SourceChips sources={f.sources} tierClass={TIER_CLASS} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards — no horizontal scroll for the core table */}
            <ul className="space-y-2 sm:hidden">
              {visibleFields.map((f) => {
                const conflicted = f.conflictWeight > 0;
                return (
                  <li key={f.field} className="rounded-lg border border-gray-200 dark:border-neutral-700 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {FIELD_LABEL[f.field] ?? f.field}
                        {f.required && <span className="ml-1 text-[10px] text-red-500">required</span>}
                      </span>
                      <span className="shrink-0 text-xs">
                        <span className={conflicted ? 'text-amber-600 dark:text-amber-400' : scoreToneClass(f.score)}>
                          {f.score}
                        </span>
                        {conflicted && <span className="ml-1 text-[10px] text-red-500">conflict</span>}
                      </span>
                    </div>
                    <div className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-300">{f.value ?? '—'}</div>
                    <div className="mt-1.5">
                      <SourceChips sources={f.sources} tierClass={TIER_CLASS} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
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
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Source</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Tier</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Corroborates</th>
                  <th scope="col" className="py-1.5 font-semibold">Accessed</th>
                </tr>
              </thead>
              <tbody>
                {packet.ledger.map((l, i) => (
                  <tr key={`${l.independenceGroup}-${l.name}-${i}`} className="border-b border-gray-100 dark:border-neutral-800">
                    <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-200">
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          {sourceLabel(l.name)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        sourceLabel(l.name)
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

      {showVerify && (
        <ResolveVerificationModal
          mode="campaign"
          entry={verificationEntry}
          conflictFields={conflictFields}
          onClose={() => setShowVerify(false)}
          onResolved={load}
        />
      )}
    </div>
  );
}
