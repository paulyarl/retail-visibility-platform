'use client';

/**
 * Proving Ground cockpit (Migration 262, spec §4.10).
 *
 * The PG-01 checklist + the worklist surface the day-to-day; the cockpit is
 * the launch operator's system-state overview: G1–G4 gates, preflight
 * progress, due-today, mid-run gap log, tree children, and the dedup
 * resolution panel (preflight step 1 — duplicateSeedCount must reach 0).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2, RefreshCw, X, ListChecks, GitBranch, AlertTriangle,
  ExternalLink, CheckCircle2, Circle, Link2, Unlink, Phone, Users, Search, MapPin,
  Eye, Save, RotateCcw, Trash2,
} from 'lucide-react';
import marketingOpsService, {
  type Audit,
  type CampaignDetail,
  type CampaignLineageEntry,
  type ProspectDismissReason,
  type ProspectQueueEntry,
} from '@/services/MarketingOpsService';
import directoryPresenceAdminService, {
  type CohortFunnelResponse,
  type PotentialDuplicateSeed,
} from '@/services/DirectoryPresenceAdminService';
import CampaignChecklistTab from '@/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignChecklistTab';
import IntelligenceDiscoveryAuditCard from '@/components/marketing-ops/IntelligenceDiscoveryAuditCard';

interface Props {
  campaignId: string;
}

const GATE_LABELS: Record<string, string> = {
  G1: 'Trust',
  G2: 'Contact',
  G3: 'Claim',
  G4: 'Convert',
};

function gateChip(pass: boolean | null): string {
  if (pass === true) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (pass === false) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400';
}

export default function ProvingGroundCockpitClient({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [children, setChildren] = useState<CampaignLineageEntry[]>([]);
  const [funnel, setFunnel] = useState<CohortFunnelResponse | null>(null);
  const [dueToday, setDueToday] = useState<ProspectQueueEntry[]>([]);
  const [attachable, setAttachable] = useState<CampaignLineageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attachId, setAttachId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [verdictBusy, setVerdictBusy] = useState<string | null>(null);
  const [gapFormOpen, setGapFormOpen] = useState(false);
  const [gapBusy, setGapBusy] = useState(false);
  const [gapForm, setGapForm] = useState<{ field: string; description: string; severity: 'critical' | 'important' | 'minor'; resolver: 'self' | 'staff' | 'developer' }>({
    field: '', description: '', severity: 'important', resolver: 'self',
  });

  // Category market enrichment status for this proving ground's (category, city, state)
  const [marketStatus, setMarketStatus] = useState<any | null>(null);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Directory enrichment lane — create a category/location enrichment
  // campaign prefilled with this proving ground's market and attach it as a
  // child (the attach guard accepts directory_enrichment children).
  const [enrichCampaignBusy, setEnrichCampaignBusy] = useState<'category' | 'location' | null>(null);
  const [enrichCampaignError, setEnrichCampaignError] = useState<string | null>(null);
  const [enrichCampaignCreated, setEnrichCampaignCreated] = useState<{ id: string; title: string | null } | null>(null);

  // Public copy — the market SEO the enrichment feeds the public category×city
  // surfaces (meta title / description / keywords). Viewer + operator override
  // with the same semantics as the category-enrichment markets page: blank
  // override keeps the composed copy, Reset clears an existing override.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyEditing, setCopyEditing] = useState(false);
  const [copySaving, setCopySaving] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [ovMetaTitle, setOvMetaTitle] = useState('');
  const [ovDescription, setOvDescription] = useState('');
  const [ovKeywords, setOvKeywords] = useState('');
  const [resetMetaTitle, setResetMetaTitle] = useState(false);
  const [resetDescription, setResetDescription] = useState(false);
  const [resetKeywords, setResetKeywords] = useState(false);

  // Discovery prospects — loaded on demand from the attached intelligence
  // campaigns' intelligence_discovery audits.
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [prospectsLoaded, setProspectsLoaded] = useState(false);
  const [prospectsError, setProspectsError] = useState<string | null>(null);
  const [discoveryAudits, setDiscoveryAudits] = useState<Array<{ childId: string; childTitle: string; audit: Audit }>>([]);
  const gapLogRef = useRef<HTMLDivElement | null>(null);

  // Promote to listings (preflight step 2) — selective seeding of tree-scoped
  // queue entries via proving-ground-seed. Hold-priority prospects default to
  // unchecked so analysts' holds are not promoted by accident.
  const [promoteEntries, setPromoteEntries] = useState<ProspectQueueEntry[]>([]);
  const [promoteSelected, setPromoteSelected] = useState<Set<string>>(new Set());
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Per-row dismiss — removes a prospect from the promote list and the
  // worklist (status='dismissed'). Inline reason picker; rows already
  // promoted (seed_id set) are not dismissible here — the published listing
  // needs the directory panel, not a queue status flip.
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState<ProspectDismissReason>('bad_fit');
  const [dismissBusy, setDismissBusy] = useState(false);

  // Seed delete (promoted rows) — permanent teardown of the minted seed
  // (listing + tenant + tokens + campaign links). The queue stamp is cleared
  // server-side, so the prospect returns to the promote list un-promoted.
  const [deleteSeedTarget, setDeleteSeedTarget] = useState<{ id: string; seedId: string; name: string } | null>(null);
  const [deleteSeedBusy, setDeleteSeedBusy] = useState(false);

  const treeIds = useMemo(
    () => [campaignId, ...children.map((c) => c.id)],
    [campaignId, children],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const camp = await marketingOpsService.getCampaign(campaignId);
      setCampaign(camp);

      // Load category market enrichment status when proving ground scope is (category, city, state)
      if (
        camp.campaign_category === 'proving_ground' &&
        camp.category &&
        camp.city &&
        camp.state
      ) {
        try {
          const market = await directoryPresenceAdminService.getMarket({
            category: camp.category,
            city: camp.city,
            state: camp.state,
          });
          setMarketStatus(market);
        } catch {
          // Non-blocking: enrichment status is optional observability.
          setMarketStatus(null);
        }
      }

      const childList = camp.children ?? [];
      setChildren(childList);
      const ids = [campaignId, ...childList.map((c) => c.id)];
      const [funnelReport, queue] = await Promise.all([
        directoryPresenceAdminService.getCohortFunnel({ campaignIds: ids }),
        marketingOpsService.listProspectQueue({
          source_campaign_ids: ids,
          // campaign_created included: a prospect that graduated to a campaign
          // is exactly the audit-first promotion candidate — it must stay on
          // the promote panel, not vanish from it.
          status: ['queued', 'in_thread', 'hold', 'verify_then_outreach', 'campaign_created'],
          includeCampaigns: true,
          limit: 200,
        }),
      ]);
      setFunnel(funnelReport);
      const sorted = queue.entries
        .filter((e) => e.seed_id && e.next_touch_at)
        .sort((a, b) => new Date(a.next_touch_at!).getTime() - new Date(b.next_touch_at!).getTime());
      setDueToday(sorted.slice(0, 10));

      // Promotion panel: every non-dismissed tree prospect — including
      // campaign_created rows, since graduation to campaign + audit is the
      // pre-condition for promotion, not an exit. Duplicate identities (same
      // business + city — legacy rows queued twice around a graduation) are
      // collapsed to the most-advanced row: seeded > campaign_created >
      // live-queue statuses, so the panel can never offer the same business
      // twice (promoting both would mint duplicate listings). Rows without a
      // business_name (category/city scope) are never collapsed.
      const identityRank = (e: ProspectQueueEntry) =>
        e.seed_id ? 3 : e.status === 'campaign_created' ? 2 : 1;
      const byIdentity = new Map<string, ProspectQueueEntry>();
      for (const e of queue.entries) {
        if (e.status === 'dismissed') continue;
        const key = e.business_name
          ? `${e.business_name.toLowerCase().trim()}|${(e.city ?? '').toLowerCase().trim()}`
          : `id:${e.id}`;
        const existing = byIdentity.get(key);
        if (!existing) {
          byIdentity.set(key, e);
        } else if (identityRank(e) > identityRank(existing)) {
          byIdentity.set(key, e);
        }
      }
      const promotable = [...byIdentity.values()];
      setPromoteEntries(promotable);
      setPromoteSelected(
        new Set(
          promotable
            .filter((e) => !e.seed_id && e.business_seek_priority !== 'hold' && e.campaign_has_business_audit === true)
            .map((e) => e.id),
        ),
      );

      // Attachable = unparented intelligence *discovery prospect* runs
      // (kind = discovery, focus = emerging | competitive) — the same gate
      // as the promote action. Establishment and gold-standards runs
      // produce profiles, not prospects, and are often state/nationwide
      // scoped, so they are excluded here too.
      const intel = await marketingOpsService.listCampaigns({ scope: 'intelligence', limit: 100 });
      setAttachable(
        intel.items
          .filter((c) =>
            !c.parent_campaign_id
            && !ids.includes(c.id)
            && (c.intelligence_campaign_kind ?? 'discovery') === 'discovery'
            && ['emerging', 'competitive'].includes(c.intelligence_focus ?? 'emerging'))
          .map((c) => ({ id: c.id, title: c.title, business_name: c.business_name, scope: c.scope, stage: c.stage, category: c.category, city: c.city })),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load proving ground');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleAttach = async () => {
    if (!attachId) return;
    setAttaching(true);
    try {
      await marketingOpsService.attachProvingGroundChild(campaignId, attachId);
      setAttachId('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to attach child');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetach = async (childId: string) => {
    try {
      await marketingOpsService.detachProvingGroundChild(campaignId, childId);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to detach child');
    }
  };

  const handleEnrichMarket = async () => {
    if (!campaign || campaign.campaign_category !== 'proving_ground' || !campaign.category || !campaign.city || !campaign.state) {
      setEnrichError('Campaign is missing category/city/state for market enrichment');
      return;
    }
    setEnrichBusy(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const result = await directoryPresenceAdminService.enrichMarket({
        category: campaign.category,
        city: campaign.city,
        state: campaign.state,
      });
      setEnrichResult(
        `Market enriched: ${result.listingsEnriched} listing${result.listingsEnriched === 1 ? '' : 's'} enriched, ${result.listingsSkipped} skipped.`
      );
      await load();
    } catch (err: any) {
      setEnrichError(err.message || 'Failed to enrich market');
    } finally {
      setEnrichBusy(false);
    }
  };

  // Directory enrichment lane — spawn a category- or location-scope
  // enrichment campaign prefilled with this market and attach it as a child.
  const handleCreateEnrichmentCampaign = async (kind: 'category' | 'location') => {
    if (!campaign || campaign.campaign_category !== 'proving_ground' || !campaign.city || !campaign.state) {
      setEnrichCampaignError('Campaign is missing city/state for enrichment');
      return;
    }
    if (kind === 'category' && !campaign.category) {
      setEnrichCampaignError('Campaign is missing category for category enrichment');
      return;
    }
    setEnrichCampaignBusy(kind);
    setEnrichCampaignError(null);
    setEnrichCampaignCreated(null);
    try {
      const created = await marketingOpsService.createEnrichmentCampaign({
        kind,
        category: kind === 'category' ? campaign.category : undefined,
        city: campaign.city,
        state: campaign.state,
        parentCampaignId: campaignId,
      });
      setEnrichCampaignCreated({ id: created.id, title: created.title });
      await load();
    } catch (err: any) {
      setEnrichCampaignError(err.message || 'Failed to create enrichment campaign');
    } finally {
      setEnrichCampaignBusy(null);
    }
  };

  // ─── Public copy (market SEO) — view + operator override ────────────────

  const openCopyEditor = () => {
    if (!marketStatus) return;
    setOvMetaTitle(marketStatus.override?.metaTitle || '');
    setOvDescription(marketStatus.override?.description || '');
    setOvKeywords((marketStatus.override?.keywords || []).join(', '));
    setResetMetaTitle(false);
    setResetDescription(false);
    setResetKeywords(false);
    setCopyError(null);
    setCopyEditing(true);
  };

  const handleSaveCopy = async () => {
    if (!marketStatus) return;
    setCopySaving(true);
    setCopyError(null);
    try {
      const keywords = ovKeywords.split(',').map((k) => k.trim()).filter(Boolean);
      const updated = await directoryPresenceAdminService.overrideMarket(
        marketStatus.categoryKey,
        marketStatus.city,
        marketStatus.state,
        {
          operator_override_description: ovDescription.trim() || undefined,
          operator_override_meta_title: ovMetaTitle.trim() || undefined,
          operator_override_keywords: keywords.length > 0 ? keywords : undefined,
          reset_description: resetDescription,
          reset_meta_title: resetMetaTitle,
          reset_keywords: resetKeywords,
        },
      );
      setMarketStatus(updated);
      setCopyEditing(false);
    } catch (err: any) {
      setCopyError(err.message || 'Failed to save copy overrides');
    } finally {
      setCopySaving(false);
    }
  };

  const handleVerdict = async (group: PotentialDuplicateSeed, verdict: 'same_entity' | 'distinct') => {
    const key = group.seedIds.join(',');
    setVerdictBusy(key);
    setError(null);
    try {
      await directoryPresenceAdminService.recordDedupVerdict({
        seedIds: group.seedIds,
        matchKey: group.matchKey,
        verdict,
        mergeInto: verdict === 'same_entity' ? group.seedIds[0] : undefined,
      });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to record verdict');
    } finally {
      setVerdictBusy(null);
    }
  };

  // ─── Selective promotion (preflight step 2) ─────────────────────────────

  const togglePromote = (id: string) => {
    setPromoteSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPromote = () => {
    const promotable = promoteEntries.filter((e) => !e.seed_id);
    const allSelected = promotable.length > 0 && promotable.every((e) => promoteSelected.has(e.id));
    setPromoteSelected(allSelected ? new Set() : new Set(promotable.map((e) => e.id)));
  };

  const handlePromoteSelected = async () => {
    const ids = [...promoteSelected];
    if (ids.length === 0) return;
    setPromoteBusy(true);
    setPromoteError(null);
    setPromoteResult(null);
    try {
      const seedBatch = `pg-${campaignId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
      const result = await directoryPresenceAdminService.provingGroundSeed(ids, seedBatch);
      const parts = [
        `${result.created.length} listing${result.created.length === 1 ? '' : 's'} created`,
        result.skipped.length ? `${result.skipped.length} skipped` : null,
        result.failed.length ? `${result.failed.length} failed` : null,
      ].filter(Boolean);
      setPromoteResult(`Promotion complete: ${parts.join(', ')}.`);
      await load();
    } catch (err: any) {
      setPromoteError(err.message || 'Failed to promote prospects');
    } finally {
      setPromoteBusy(false);
    }
  };

  // Dismiss removes a prospect from the promote list and the worklist
  // (status='dismissed' — idempotent, row retained as history; viewable on
  // the queue page under the dismissed filter).
  const handleDismiss = async (id: string) => {
    setDismissBusy(true);
    setError(null);
    try {
      await marketingOpsService.dismissProspectQueue(id, dismissReason);
      setDismissId(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss prospect');
    } finally {
      setDismissBusy(false);
    }
  };

  // Delete a promoted seed — permanent teardown; the backend clears the
  // queue stamp so the prospect returns to the promote list un-promoted.
  const handleDeleteSeed = async () => {
    if (!deleteSeedTarget) return;
    setDeleteSeedBusy(true);
    setError(null);
    try {
      const result = await directoryPresenceAdminService.deleteSeed(deleteSeedTarget.seedId);
      if (result?.deleted === false) {
        setError(
          result.reason === 'seed_already_claimed'
            ? 'Seed already claimed by a customer — delete refused. Use suppress on the seed workspace instead.'
            : `Delete failed: ${result.reason ?? 'unknown reason'}`,
        );
      } else {
        setPromoteResult(`Seed deleted — ${deleteSeedTarget.name} returned to the promote list.`);
      }
      setDeleteSeedTarget(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete seed');
    } finally {
      setDeleteSeedBusy(false);
    }
  };

  const handleAppendGap = async () => {
    setGapBusy(true);
    setError(null);
    try {
      await marketingOpsService.appendGapLog(campaignId, gapForm);
      setGapForm({ field: '', description: '', severity: 'important', resolver: 'self' });
      setGapFormOpen(false);
      const camp = await marketingOpsService.getCampaign(campaignId);
      setCampaign(camp);
    } catch (err: any) {
      setError(err.message || 'Failed to log gap');
    } finally {
      setGapBusy(false);
    }
  };

  // Load the businesses the attached intelligence (discovery) campaigns found.
  // Discovery results live on the child campaign as intelligence_discovery
  // audits (audit_data.discovered_businesses) — fetch each child's detail and
  // collect those audits, newest first.
  const loadDiscoveryProspects = useCallback(async () => {
    if (children.length === 0) return;
    setProspectsLoading(true);
    setProspectsError(null);
    try {
      const details = await Promise.all(children.map((c) => marketingOpsService.getCampaign(c.id)));
      const found: Array<{ childId: string; childTitle: string; audit: Audit }> = [];
      children.forEach((child, i) => {
        const detail = details[i];
        const audits = (detail?.audits ?? [])
          .filter((a) => a.platform === 'intelligence_discovery' && a.audit_data && typeof a.audit_data === 'object' && 'discovered_businesses' in a.audit_data)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        for (const audit of audits) {
          found.push({
            childId: child.id,
            childTitle: child.title || child.business_name || child.id,
            audit,
          });
        }
      });
      setDiscoveryAudits(found);
      setProspectsLoaded(true);
      if (found.length === 0) {
        setProspectsError('No discovery results on the attached intelligence campaign(s) — run the discovery prompt first, then reload.');
      }
    } catch (err: any) {
      setProspectsError(err.message || 'Failed to load discovery prospects');
    } finally {
      setProspectsLoading(false);
    }
  }, [children]);

  // Log a gap against a specific prospect: prefill the campaign gap form with
  // the prospect identity so the entry lands on the proving ground's
  // append-only gap log (spec §4.5) with full context.
  const handleProspectGap = useCallback((bizName: string, bizCity?: string, bizState?: string) => {
    const where = [bizCity, bizState].filter(Boolean).join(', ');
    setGapForm({
      field: `prospect.${bizName}`,
      description: where ? `${bizName} (${where}) — ` : `${bizName} — `,
      severity: 'important',
      resolver: 'self',
    });
    setGapFormOpen(true);
    setProspectsError(null);
    requestAnimationFrame(() => gapLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading proving ground…
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-sm text-red-600 dark:text-red-400 py-8">{error ?? 'Campaign not found'}</div>;
  }

  const combined = funnel?.combined;
  const gates = combined?.gates ?? [];
  const dupGroups = funnel?.potentialDuplicateSeeds ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {campaign.title || `${campaign.category ?? 'Proving Ground'} · ${campaign.city ?? ''}`}
              </h1>
              <span className="rounded bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold uppercase">
                proving ground
              </span>
              <span className="rounded bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300 px-2 py-0.5 text-[10px] font-medium">
                {campaign.stage}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {[campaign.category, campaign.city, campaign.state].filter(Boolean).join(' · ')}
              {' '}· {children.length} intelligence campaign{children.length !== 1 ? 's' : ''} attached
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/admin/marketing-ops/queue"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              <Phone className="w-3.5 h-3.5" />
              Open Worklist
            </Link>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gate chips */}
        {gates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700">
            {gates.map((g) => (
              <span
                key={g.gate}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${gateChip(g.pass)}`}
                title={`${g.description} — value ${g.value ?? 'n/a'} vs threshold ${g.threshold}`}
              >
                {g.pass === true ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                {g.gate} {GATE_LABELS[g.gate] ? `· ${GATE_LABELS[g.gate]}` : ''}
              </span>
            ))}
            <span className="text-[10px] text-gray-400 ml-1">
              {combined?.grade === 'decision_grade' ? 'decision-grade' : 'directional'} grade
            </span>
          </div>
        )}

        {/* Market enrichment status line + public copy */}
        {campaign.campaign_category === 'proving_ground' && campaign.category && campaign.city && campaign.state && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {marketStatus ? (
                  <span>
                    Market enrichment:{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {marketStatus.triggerSource === 'profile_activated' ? 'auto-fired on profile activation' : marketStatus.triggerSource}
                    </span>{' '}
                    · {new Date(marketStatus.enrichedAt).toLocaleString()}
                    {marketStatus.intelligenceProfileId && (
                      <span className="ml-1">· profile {marketStatus.intelligenceProfileId}</span>
                    )}
                  </span>
                ) : (
                  <span>Market enrichment: not enriched yet</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {marketStatus && (
                  <button
                    onClick={() => { setCopyOpen((o) => !o); setCopyEditing(false); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
                    title="Show the SEO copy this market feeds the public category pages"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Public copy
                  </button>
                )}
                <button
                  onClick={handleEnrichMarket}
                  disabled={enrichBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {enrichBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Enrich Market Listings
                </button>
                <button
                  onClick={() => handleCreateEnrichmentCampaign('category')}
                  disabled={enrichCampaignBusy !== null}
                  title="Create a directory_enrichment campaign for this category market and attach it under this proving ground"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
                >
                  {enrichCampaignBusy === 'category' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                  Category enrichment campaign
                </button>
                <button
                  onClick={() => handleCreateEnrichmentCampaign('location')}
                  disabled={enrichCampaignBusy !== null}
                  title="Create a directory_enrichment campaign for this location (city) and attach it under this proving ground"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
                >
                  {enrichCampaignBusy === 'location' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  Location enrichment campaign
                </button>
              </div>
            </div>
            {(enrichCampaignCreated || enrichCampaignError) && (
              <div className="mt-2">
                {enrichCampaignCreated && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Enrichment campaign created and attached —{' '}
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${enrichCampaignCreated.id}`}
                      className="font-medium underline"
                    >
                      {enrichCampaignCreated.title || enrichCampaignCreated.id}
                    </Link>
                  </p>
                )}
                {enrichCampaignError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{enrichCampaignError}</p>
                )}
              </div>
            )}

            {/* Public copy panel — effective copy + operator override editor */}
            {copyOpen && marketStatus && (
              <div className="mt-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/40 p-3 space-y-3">
                {!copyEditing ? (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Live on public {marketStatus.categoryName || campaign.category} · {campaign.city} pages
                      </p>
                      <button
                        onClick={openCopyEditor}
                        className="text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        tweak copy
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">
                        Meta title · {marketStatus.override?.metaTitle ? 'operator override' : 'composed'}
                      </p>
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{marketStatus.effective?.metaTitle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">
                        Description · {marketStatus.override?.description ? 'operator override' : 'composed'}
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{marketStatus.effective?.description}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">
                        Keywords · {marketStatus.override?.keywords ? 'operator override' : 'composed'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(marketStatus.effective?.keywords || []).map((k: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                    {marketStatus.overrideBy && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Overridden by {marketStatus.overrideBy} · {marketStatus.overrideAt ? new Date(marketStatus.overrideAt).toLocaleString() : '—'}
                      </p>
                    )}
                    <Link
                      href="/settings/admin/directory/category-enrichment/markets"
                      className="inline-block text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Full market editor →
                    </Link>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-gray-400">
                      Blank field keeps the composed copy · tick Reset to clear an override and fall back to composed.
                    </p>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Composed meta title</label>
                      <div className="p-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                        {marketStatus.composed?.metaTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={ovMetaTitle}
                        onChange={(e) => setOvMetaTitle(e.target.value)}
                        disabled={resetMetaTitle}
                        maxLength={70}
                        placeholder="Override meta title (≤ 70 chars)"
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800 disabled:text-gray-400"
                      />
                      <label className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <input type="checkbox" checked={resetMetaTitle} onChange={(e) => setResetMetaTitle(e.target.checked)} />
                        <RotateCcw className="w-3 h-3" /> Reset
                      </label>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Composed description</label>
                      <div className="p-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {marketStatus.composed?.description}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={3}
                        value={ovDescription}
                        onChange={(e) => setOvDescription(e.target.value)}
                        disabled={resetDescription}
                        maxLength={1000}
                        placeholder="Override description (≤ 1000 chars)"
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800 disabled:text-gray-400"
                      />
                      <label className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap mt-2">
                        <input type="checkbox" checked={resetDescription} onChange={(e) => setResetDescription(e.target.checked)} />
                        <RotateCcw className="w-3 h-3" /> Reset
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={ovKeywords}
                        onChange={(e) => setOvKeywords(e.target.value)}
                        disabled={resetKeywords}
                        placeholder="Override keywords (comma-separated, ≤ 15)"
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800 disabled:text-gray-400"
                      />
                      <label className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <input type="checkbox" checked={resetKeywords} onChange={(e) => setResetKeywords(e.target.checked)} />
                        <RotateCcw className="w-3 h-3" /> Reset
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setCopyEditing(false)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCopy}
                        disabled={copySaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                      >
                        {copySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save copy
                      </button>
                    </div>
                  </div>
                )}
                {copyError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{copyError}</p>
                )}
              </div>
            )}
          </div>
        )}
        {enrichResult && (
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">{enrichResult}</div>
        )}
        {enrichError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">{enrichError}</div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Funnel metrics + due-today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4" /> Tree funnel (combined)
          </h2>
          {combined ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Seeds', combined.metrics.seeds],
                ['NAP verified', combined.metrics.napVerified],
                ['Touches', combined.metrics.touches],
                ['Invites', combined.metrics.invited],
                ['Claimed', combined.metrics.claimed],
                ['CAC est.', combined.metrics.cacEstimate != null ? `$${combined.metrics.cacEstimate.toFixed(0)}` : '—'],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded-lg bg-gray-50 dark:bg-neutral-700/30 px-2 py-2">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{val}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No funnel data — link seeds via the preflight seeding step.</p>
          )}
          {funnel && (
            <p className="text-[10px] text-gray-400 mt-2">
              {funnel.duplicateSeedCount} unresolved duplicate group{funnel.duplicateSeedCount !== 1 ? 's' : ''}
              {combined?.medianDaysToClaim != null && ` · median ${combined.medianDaysToClaim}d to claim`}
            </p>
          )}
        </div>

        {/* Due today */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4" /> Due today
          </h2>
          {dueToday.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing due — promote prospects to listings (preflight step 2) to populate the worklist.</p>
          ) : (
            <ul className="space-y-1.5">
              {dueToday.map((e) => {
                const due = e.next_touch_at ? new Date(e.next_touch_at).getTime() <= Date.now() : false;
                return (
                  <li key={e.id} className="flex items-center justify-between text-xs">
                    <Link href="/settings/admin/marketing-ops/queue" className="text-gray-800 dark:text-gray-200 hover:underline">
                      {e.title || e.business_name || 'prospect'}
                    </Link>
                    <span className={`text-[10px] ${due ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-400'}`}>
                      {due ? '● due now' : e.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Preflight checklist — PG-01 attaches directly, no triage needed */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Preflight checklist (PG-01)</h2>
        <CampaignChecklistTab campaignId={campaignId} currentStage={campaign.stage} />
      </div>

      {/* Duplicate resolution — preflight step 1's data surface */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" /> Duplicate seed groups
        </h2>
        {dupGroups.length === 0 ? (
          <p className="text-xs text-green-700 dark:text-green-400">
            No unresolved duplicate groups — the funnel identity gate is clean.
          </p>
        ) : (
          <ul className="space-y-2">
            {dupGroups.map((g) => (
              <li key={g.seedIds.join(',')} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-mono text-[10px] uppercase text-gray-400 mr-2">{g.matchKey}</span>
                  {g.names.join('  ↔  ')}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleVerdict(g, 'same_entity')}
                    disabled={verdictBusy === g.seedIds.join(',')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                    title="Same entity — merges identity into the first seed"
                  >
                    {verdictBusy === g.seedIds.join(',') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Same entity
                  </button>
                  <button
                    onClick={() => handleVerdict(g, 'distinct')}
                    disabled={verdictBusy === g.seedIds.join(',')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 disabled:opacity-50"
                  >
                    <Unlink className="w-3 h-3" />
                    Distinct
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Promote to listings — preflight step 2's data surface: selective
          seeding of tree prospects. Hold-priority rows default unchecked. */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Promote to listings (preflight step 2)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAllPromote}
              disabled={promoteBusy || promoteEntries.every((e) => e.seed_id)}
              className="text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {promoteEntries.filter((e) => !e.seed_id).length > 0
                && promoteEntries.filter((e) => !e.seed_id).every((e) => promoteSelected.has(e.id))
                ? 'clear all' : 'select all'}
            </button>
            <button
              onClick={handlePromoteSelected}
              disabled={promoteBusy || promoteSelected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              title="Create + publish a directory listing per selected prospect, link it to its discovery campaign, and mint a claim token"
            >
              {promoteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              Promote selected ({promoteSelected.size})
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">
          Creates + publishes a directory listing per selected prospect, links it to its discovery campaign, and mints a claim token.
          Audit-backed prospects are pre-checked — a business audit per prospect makes richer seed data. Hold-priority prospects stay
          unchecked until an analyst's hold is resolved; dismiss removes a prospect from the list entirely.
        </p>
        {promoteEntries.length === 0 ? (
          <p className="text-xs text-gray-400">
            No workable prospects yet — queue businesses from the discovery panel below, then promote selectively here.
          </p>
        ) : (
          <>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
              {promoteEntries.filter((e) => e.campaign_has_business_audit === true).length} of {promoteEntries.length} prospects have a
              business audit
              {promoteEntries.some((e) => !e.seed_id && e.campaign_has_business_audit !== true) && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}· {promoteEntries.filter((e) => !e.seed_id && e.campaign_has_business_audit !== true).length} awaiting campaign/audit
                </span>
              )}
              {[...promoteSelected].filter((id) => {
                const e = promoteEntries.find((p) => p.id === id);
                return e && e.campaign_has_business_audit !== true;
              }).length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}· {promoteSelected.size - promoteEntries.filter((e) => promoteSelected.has(e.id) && e.campaign_has_business_audit === true).length} selected without audit (thinner seed data)
                </span>
              )}
            </p>
            <ul className="space-y-1">
              {promoteEntries.map((e) => {
                const isHold = e.business_seek_priority === 'hold';
                const promoted = !!e.seed_id;
                const audited = e.campaign_has_business_audit === true;
                const checked = promoted || promoteSelected.has(e.id);
                return (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      promoted
                        ? 'bg-green-50/60 dark:bg-green-900/10'
                        : isHold
                          ? 'bg-gray-50 dark:bg-neutral-700/20'
                          : 'hover:bg-gray-50 dark:hover:bg-neutral-700/30'
                    }`}
                  >
                    <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={promoted || promoteBusy}
                        onChange={() => togglePromote(e.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                      />
                      <span className={`truncate font-medium ${promoted ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                        {e.business_name || e.title || e.id}
                      </span>
                      {isHold && !promoted && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" /> hold
                        </span>
                      )}
                      {promoted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 flex-shrink-0">
                          promoted
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 flex items-center gap-1.5">
                      {dismissId === e.id ? (
                        <>
                          <select
                            value={dismissReason}
                            onChange={(ev) => setDismissReason(ev.target.value as ProspectDismissReason)}
                            className="px-1 py-0.5 text-[10px] border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                            title="Why is this prospect being dismissed?"
                          >
                            <option value="bad_fit">bad fit</option>
                            <option value="duplicate">duplicate</option>
                            <option value="already_customer">already customer</option>
                            <option value="unverified_closed">closed</option>
                            <option value="other">other</option>
                          </select>
                          <button
                            onClick={() => handleDismiss(e.id)}
                            disabled={dismissBusy}
                            className="text-[10px] font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            {dismissBusy ? '…' : 'confirm'}
                          </button>
                          <button
                            onClick={() => setDismissId(null)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {e.processed_campaign_id ? (
                            <>
                              <Link
                                href={`/settings/admin/marketing-ops/campaigns/${e.processed_campaign_id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                title="Open the prospect's campaign"
                              >
                                campaign{e.campaign_stage ? ` · ${e.campaign_stage}` : ''}
                              </Link>
                              {audited ? (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800"
                                  title={e.business_audit_at ? `Business audit ${new Date(e.business_audit_at).toLocaleDateString()}` : 'Business audit on file'}
                                >
                                  audited
                                </span>
                              ) : (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                  title="No business_analysis audit yet — run the audit before seeding for richer listing data"
                                >
                                  no audit
                                </span>
                              )}
                            </>
                          ) : (
                            <span title="No campaign yet — seeding uses the discovery snapshot only">no campaign</span>
                          )}
                          {promoted && e.seed_id && (
                            <>
                              <Link
                                href={`/settings/admin/directory/presence-seeds/${e.seed_id}`}
                                className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
                                title="Open the seed workspace"
                              >
                                <Eye className="w-3 h-3" />
                                seed
                              </Link>
                              <button
                                onClick={() => setDeleteSeedTarget({ id: e.id, seedId: e.seed_id!, name: e.business_name || e.title || e.id })}
                                disabled={promoteBusy || dismissBusy || deleteSeedBusy}
                                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                title="Delete this seed — permanently removes the listing and its tenant; the prospect returns to the promote list"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <span>
                            {e.status}
                            {e.identity_confidence ? ` · conf: ${e.identity_confidence}` : ''}
                          </span>
                          {!promoted && (
                            <button
                              onClick={() => { setDismissId(e.id); setDismissReason('bad_fit'); }}
                              disabled={promoteBusy || dismissBusy}
                              className="text-[10px] text-gray-400 hover:text-red-600 disabled:opacity-50"
                              title="Dismiss this prospect — removes it from the promote list and the worklist (viewable under 'dismissed' on the queue page)"
                            >
                              dismiss
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {promoteResult && (
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">{promoteResult}</div>
        )}
        {promoteError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">{promoteError}</div>
        )}
      </div>

      {/* Seed delete confirmation — mirrors the presence-seeds page's modal */}
      {deleteSeedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete this seed?</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This permanently deletes the seed, its directory listing, the seed
              tenant, and all related claim tokens, provenance, and campaign
              links. This cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{deleteSeedTarget.name}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The prospect returns to the promote list un-promoted.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteSeedTarget(null)}
                disabled={deleteSeedBusy}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSeed}
                disabled={deleteSeedBusy}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSeedBusy ? 'Deleting…' : 'Delete seed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Intelligence campaigns ({children.length})
        </h2>
        {children.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {c.title || c.business_name || `${c.category ?? ''} · ${c.city ?? ''}`}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{c.stage}</span>
                  <button
                    onClick={() => handleDetach(c.id)}
                    className="text-[10px] text-gray-400 hover:text-red-600"
                    title="Detach from this proving ground (breadcrumbs only)"
                  >
                    detach
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <select
            value={attachId}
            onChange={(e) => setAttachId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
          >
            <option value="">Attach an unparented discovery campaign…</option>
            {attachable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || c.business_name || `${c.category ?? ''} · ${c.city ?? ''}`}
              </option>
            ))}
          </select>
          <button
            onClick={handleAttach}
            disabled={!attachId || attaching}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {attaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Attach
          </button>
        </div>
      </div>

      {/* Discovery prospects — loaded on demand from the attached intelligence campaigns */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4" /> Discovery prospects
          </h2>
          <button
            onClick={loadDiscoveryProspects}
            disabled={prospectsLoading || children.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            title={children.length === 0 ? 'Attach an intelligence campaign first' : 'Load the businesses the attached discovery campaign(s) found'}
          >
            {prospectsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {prospectsLoaded ? 'Reload prospects' : 'Load prospects'}
          </button>
        </div>
        {children.length === 0 ? (
          <p className="text-xs text-gray-400">
            No intelligence campaigns attached — attach a discovery campaign above, then load its prospects here.
          </p>
        ) : prospectsLoading ? (
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading businesses from the attached discovery campaign{children.length !== 1 ? 's' : ''}…
          </p>
        ) : prospectsError ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{prospectsError}</p>
        ) : discoveryAudits.length === 0 ? (
          <p className="text-xs text-gray-400">
            Click "Load prospects" to pull the businesses the attached discovery campaign{children.length !== 1 ? 's' : ''} found into this panel.
          </p>
        ) : (
          <div className="space-y-4">
            {discoveryAudits.map(({ childId, childTitle, audit }) => (
              <div key={audit.id}>
                {discoveryAudits.length > 1 && (
                  <p className="text-[10px] text-gray-400 mb-1">
                    from{' '}
                    <Link href={`/settings/admin/marketing-ops/campaigns/${childId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {childTitle}
                    </Link>
                  </p>
                )}
                <IntelligenceDiscoveryAuditCard
                  audit={audit}
                  campaignId={childId}
                  onLogGap={(biz) => handleProspectGap(biz.business_name, biz.city, biz.state)}
                  onQueued={load}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gap log — append-only mid-run incident record (spec §4.5) */}
      <div ref={gapLogRef} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Gap log</h2>
          <button
            onClick={() => setGapFormOpen((o) => !o)}
            className="text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            {gapFormOpen ? 'cancel' : '+ log gap'}
          </button>
        </div>
        {gapFormOpen && (
          <div className="mb-3 rounded-lg border border-gray-200 dark:border-neutral-700 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={gapForm.field}
                onChange={(e) => setGapForm((f) => ({ ...f, field: e.target.value }))}
                placeholder="Field (e.g. contact.email)"
                className="w-40 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <select
                value={gapForm.severity}
                onChange={(e) => setGapForm((f) => ({ ...f, severity: e.target.value as any }))}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              >
                <option value="critical">critical</option>
                <option value="important">important</option>
                <option value="minor">minor</option>
              </select>
              <select
                value={gapForm.resolver}
                onChange={(e) => setGapForm((f) => ({ ...f, resolver: e.target.value as any }))}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              >
                <option value="self">self-fixable</option>
                <option value="staff">staff</option>
                <option value="developer">developer</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                value={gapForm.description}
                onChange={(e) => setGapForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What's missing or broken — e.g. no verified email for any prospect"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleAppendGap}
                disabled={gapBusy || !gapForm.field.trim() || !gapForm.description.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {gapBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Append'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">Append-only — corrections are new entries, not edits.</p>
          </div>
        )}
        {(!campaign.gap_log || campaign.gap_log.length === 0) ? (
          <p className="text-xs text-gray-400">No gaps logged — unverifiable fields and missing data land here during the run.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...campaign.gap_log].reverse().map((g, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <span className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                  g.severity === 'critical' ? 'bg-red-500' : g.severity === 'important' ? 'bg-amber-500' : 'bg-gray-400'
                }`} />
                <span>
                  <span className="text-gray-400">{new Date(g.timestamp).toLocaleDateString()}</span>
                  {' '}<span className="font-medium">[{g.field}]</span> {g.description}
                  <span className="text-gray-400"> — {g.resolver}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
