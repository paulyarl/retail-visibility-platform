/**
 * StageAdviceService — "is the next pipeline stage green?" for the VAST
 * surfaces.
 *
 * The Four-Act cascade tells the operator what outreach to do next. This
 * service answers the orthogonal question: is the campaign's *pipeline*
 * bookkeeping now true enough to advance a stage? It is deliberately a view,
 * not a gate (spec §8) — every predicate it reads is the same one the
 * transition route enforces, so the board and the route cannot drift:
 *
 *   - archetype resolvable      → the `preview_built` hard gate (409)
 *   - triage declared           → the `preview_built` hard gate (409 `triage_decision_required`)
 *   - checklist required steps  → the soft gate (409 `checklist_incomplete`)
 *   - gallery eligibility       → `GALLERY_ELIGIBLE_STAGES` / screenshots
 *   - act 1 / act 3 gates       → `SeedCascadeService` derivation
 *
 * Two mechanics make the ordering non-obvious and are encoded here:
 *   - the mailer only works in `seek` / `seed` / `preview_built`, so the act-2
 *     postcard must ship before `shown`;
 *   - the act-2 confirm page leads onward to the gallery, so the gallery has
 *     to exist before the postcard is mailed.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §2.1/§2.3/§4/§8.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import type { RequestCtx } from '../context';
import type { SeedCascadeSummary } from './SeedCascadeService';
import galleryEligibilityService from './marketing/GalleryEligibilityService';
import PlaybookChecklistService from './PlaybookChecklistService';

export type StageAdviceReadiness = 'ready' | 'ready_with_ack' | 'blocked' | 'terminal';

export interface StageAdviceCheck {
  key: string;
  label: string;
  met: boolean;
  /** Advisory checks are worth saying but never stop the advance. */
  advisory: boolean;
}

export interface StageAdviceBlocker {
  code: string;
  message: string;
  /** A hard blocker is a 409 the operator cannot acknowledge away. */
  hard: boolean;
  actionLabel?: string | null;
}

export interface StageAdvice {
  campaignId: string;
  currentStage: string | null;
  nextStage: string | null;
  readiness: StageAdviceReadiness;
  checks: StageAdviceCheck[];
  blockers: StageAdviceBlocker[];
  tip: string | null;
  /** The transition will 409 with `checklist_incomplete` unless acknowledged. */
  acknowledgeRequired: boolean;
}

/**
 * The first four sales stages only. `shown` is terminal for cascade advice —
 * what remains after it is the act-4 visit and payment, neither of which is a
 * stage predicate the cascade can observe.
 */
const NEXT_STAGE: Record<string, string> = {
  seek: 'seed',
  seed: 'preview_built',
  preview_built: 'shown',
};

export interface StageAdviceFacts {
  campaignId: string;
  stage: string | null;
  scope: string | null;
  categoryIdentified: boolean;
  hasBusinessAnalysisAudit: boolean;
  hasAcceptedTriage: boolean;
  /** Campaign `playbook_code` resolved the archetype (a declared lane —
   *  sibling/playbook-created campaigns count as triage-decided). */
  hasDeclaredPlaybook: boolean;
  archetypeResolved: boolean;
  hasContact: boolean;
  operationalVerified: boolean;
  seedStatus: string | null;
  announceDelivered: boolean;
  act1Cleared: boolean;
  act1Missing: string[];
  act2Done: boolean;
  act3Cleared: boolean;
  galleryEligible: boolean;
  galleryReason: string | null;
  galleryAction: string | null;
  galleryTokenLive: boolean;
  checklistIncomplete: Array<{ id: string; title: string }>;
}

function blank(campaignId: string, stage: string | null): StageAdvice {
  return {
    campaignId,
    currentStage: stage,
    nextStage: null,
    readiness: 'terminal',
    checks: [],
    blockers: [],
    tip: null,
    acknowledgeRequired: false,
  };
}

/**
 * Pure derivation — unit-testable without a DB. Every branch maps to one of
 * the four early edges or to the terminal state.
 */
export function deriveStageAdvice(facts: StageAdviceFacts): StageAdvice {
  if (facts.scope && facts.scope !== 'business') {
    return {
      ...blank(facts.campaignId, facts.stage),
      tip: 'Only business-scope campaigns run the sales pipeline — aggregate scopes manage their children instead.',
    };
  }

  const nextStage = facts.stage ? NEXT_STAGE[facts.stage] ?? null : null;
  if (!nextStage) {
    return {
      ...blank(facts.campaignId, facts.stage),
      tip:
        facts.stage === 'shown'
          ? 'Stage is done for the cascade. What remains is the act-4 visit and the same-day claim link; the walk-in gate is still act 3.'
          : null,
    };
  }

  const checklistBlockers: StageAdviceBlocker[] = facts.checklistIncomplete.map((step) => ({
    code: 'checklist_incomplete',
    message: `Checklist step incomplete: ${step.title}`,
    hard: false,
  }));

  // ── seek → seed ────────────────────────────────────────────────────────
  if (facts.stage === 'seek') {
    const checks: StageAdviceCheck[] = [
      { key: 'category_identification', label: 'Category identification audit', met: facts.categoryIdentified, advisory: false },
      { key: 'business_analysis', label: 'Business analysis audit (non-stub)', met: facts.hasBusinessAnalysisAudit, advisory: false },
      { key: 'contact', label: 'Phone or website on file', met: facts.hasContact, advisory: true },
      { key: 'operational', label: 'Operating status verified', met: facts.operationalVerified, advisory: true },
      { key: 'triage', label: 'Triage accepted (needed at Preview Built)', met: facts.hasAcceptedTriage, advisory: true },
    ];

    const missing = checks.filter((c) => !c.met && !c.advisory);
    const blockers: StageAdviceBlocker[] = missing.map((c) => ({
      code: c.key,
      message:
        c.key === 'category_identification'
          ? 'No category identification audit — the seed has no shelf to file under.'
          : 'No business analysis audit yet — C3 has nothing to ask and act 3 nothing to show.',
      hard: false,
    }));

    if (missing.length > 0) {
      return {
        campaignId: facts.campaignId,
        currentStage: facts.stage,
        nextStage,
        readiness: 'blocked',
        checks,
        blockers,
        tip: 'Seed work builds on the audit. Run it from the Prompts tab before advancing.',
        acknowledgeRequired: false,
      };
    }

    const acknowledgeRequired = checklistBlockers.length > 0;
    return {
      campaignId: facts.campaignId,
      currentStage: facts.stage,
      nextStage,
      readiness: acknowledgeRequired ? 'ready_with_ack' : 'ready',
      checks,
      blockers: checklistBlockers,
      tip: acknowledgeRequired
        ? 'Audit and category are in — the checklist soft gate will ask you to acknowledge. Then publish after QC; do not park the seed in draft.'
        : 'Audit and category are in. Advance to Seed, then publish after QC — publish is free shelf value and opens the organic claim path, so do not park the seed in draft.',
      acknowledgeRequired,
    };
  }

  // ── seed → preview_built ───────────────────────────────────────────────
  if (facts.stage === 'seed') {
    const seedPublished = facts.seedStatus === 'published' || facts.seedStatus === 'invited';
    const checks: StageAdviceCheck[] = [
      { key: 'seed_published', label: 'Seed published (or invited with a live token)', met: seedPublished, advisory: false },
      { key: 'act1_gate', label: 'Act 1 gate: operational + channel + pain', met: facts.act1Cleared, advisory: false },
      { key: 'archetype', label: 'Archetype resolvable', met: facts.archetypeResolved, advisory: false },
      { key: 'triage_decided', label: 'Triage decided or playbook lane declared', met: facts.hasAcceptedTriage || facts.hasDeclaredPlaybook, advisory: false },
      { key: 'announce', label: 'Announce delivered (C2)', met: facts.announceDelivered, advisory: true },
    ];

    const blockers: StageAdviceBlocker[] = [];
    if (!seedPublished) {
      blockers.push({
        code: 'seed_not_published',
        message: 'Publish the seed after QC first — act 1 only works when the owner can see the listing.',
        hard: false,
      });
    }
    if (!facts.act1Cleared) {
      blockers.push({
        code: 'act1_gate',
        message: facts.act1Missing.length
          ? `Act 1 gate missing: ${facts.act1Missing.join(', ')}.`
          : 'Act 1 gate is not cleared yet.',
        hard: false,
      });
    }
    if (!facts.archetypeResolved) {
      blockers.push({
        code: 'business_analysis_required',
        message:
          'No archetype can be resolved. Preview Built has no back-edge, so this is the last safe moment — run the seek-stage business analysis.',
        hard: true,
        actionLabel: 'Run business analysis',
      });
    }
    // Mirrors the transition route's triage_decision_required 409: an
    // audit-fallback archetype is not enough — the lane must be
    // operator-declared (triage accept/override or a declared playbook).
    if (!facts.hasAcceptedTriage && !facts.hasDeclaredPlaybook) {
      blockers.push({
        code: 'triage_decision_required',
        message:
          'Triage is not decided — accept or override the recommendation so Preview Built locks in an operator-chosen lane.',
        hard: true,
        actionLabel: 'Decide triage',
      });
    }

    const hardBlocked = blockers.some((b) => b.hard);
    const softBlocked = blockers.some((b) => !b.hard);
    if (hardBlocked || softBlocked) {
      return {
        campaignId: facts.campaignId,
        currentStage: facts.stage,
        nextStage,
        readiness: 'blocked',
        checks,
        blockers,
        tip: hardBlocked
          ? 'Blocked at the door: the archetype hard gate refuses Preview Built, and there is no back-edge.'
          : 'Act 1 is the gate for the paid pitch. Finish it before building the preview.',
        acknowledgeRequired: false,
      };
    }

    const acknowledgeRequired = checklistBlockers.length > 0;
    return {
      campaignId: facts.campaignId,
      currentStage: facts.stage,
      nextStage,
      readiness: acknowledgeRequired ? 'ready_with_ack' : 'ready',
      checks,
      blockers: checklistBlockers,
      tip: acknowledgeRequired
        ? 'Act 1 cleared — the checklist soft gate will ask you to acknowledge. Advance and build the gallery before the postcard ships.'
        : 'Act 1 cleared. Advance now and build the gallery before the postcard ships — the confirm-page QR leads onward to it, and gallery links cannot be minted below Preview Built.',
      acknowledgeRequired,
    };
  }

  // ── preview_built → shown ──────────────────────────────────────────────
  const checks: StageAdviceCheck[] = [
    { key: 'act2_delivered', label: 'Act-2 artifact delivered (postcard/email)', met: facts.act2Done, advisory: false },
    { key: 'gallery_eligible', label: 'Gallery eligible (stage, screenshots, archetype)', met: facts.galleryEligible, advisory: false },
    { key: 'gallery_token', label: 'Gallery link minted', met: facts.galleryTokenLive, advisory: false },
    { key: 'act3_gate', label: 'Act-3 gate: gallery viewed', met: facts.act3Cleared, advisory: true },
  ];

  const blockers: StageAdviceBlocker[] = [];
  if (!facts.act2Done) {
    blockers.push({
      code: 'act2_not_delivered',
      message:
        'The mailer is only available up to Preview Built — send the act-2 postcard before advancing to Shown, or the channel closes.',
      hard: false,
      actionLabel: 'Open the mailer',
    });
  }
  if (!facts.galleryEligible) {
    blockers.push({
      code: facts.galleryReason ?? 'gallery_ineligible',
      message: facts.galleryAction ?? 'The gallery is not eligible yet.',
      hard: false,
      actionLabel: facts.galleryAction,
    });
  }
  if (!facts.galleryTokenLive) {
    blockers.push({
      code: 'gallery_token_missing',
      message: 'No live gallery link — generate one from the Outreach Kit before the act-3 email.',
      hard: false,
      actionLabel: 'Generate gallery link',
    });
  }

  if (blockers.length > 0) {
    return {
      campaignId: facts.campaignId,
      currentStage: facts.stage,
      nextStage,
      readiness: 'blocked',
      checks,
      blockers,
      tip: 'Shown means the preview was presented. The postcard and the gallery link are what make that true.',
      acknowledgeRequired: false,
    };
  }

  if (!facts.act3Cleared) {
    return {
      campaignId: facts.campaignId,
      currentStage: facts.stage,
      nextStage,
      readiness: 'ready_with_ack',
      checks,
      blockers: [],
      tip: 'No gallery view yet. Advancing records the preview as presented while the view is still pending — the walk-in gate keeps waiting for act 3.',
      acknowledgeRequired: true,
    };
  }

  const acknowledgeRequired = checklistBlockers.length > 0;
  return {
    campaignId: facts.campaignId,
    currentStage: facts.stage,
    nextStage,
    readiness: acknowledgeRequired ? 'ready_with_ack' : 'ready',
    checks,
    blockers: checklistBlockers,
    tip: acknowledgeRequired
      ? 'Gallery viewed and the gate is cleared — the checklist soft gate will ask you to acknowledge before Shown.'
      : 'Gallery viewed and the gate is cleared. Advance to Shown and book the walk-in from the act-4 window.',
    acknowledgeRequired,
  };
}

const OPERATIONAL_VERIFIED_MARKER = 'Operating status verified via phone call';

export class StageAdviceService extends BaseService {
  private static instance: StageAdviceService;

  private constructor() {
    super();
  }

  static getInstance(): StageAdviceService {
    if (!StageAdviceService.instance) {
      StageAdviceService.instance = new StageAdviceService();
    }
    return StageAdviceService.instance;
  }

  /**
   * Resolve advice for one campaign. `cascade` is the campaign's primary-seed
   * summary when it has one; a campaign with no seed still gets seek-stage
   * advice (the seed is what it is about to create).
   */
  async resolveForCampaign(
    campaignId: string,
    cascade: SeedCascadeSummary | null,
    ctx?: RequestCtx,
  ): Promise<StageAdvice | null> {
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        stage: true,
        scope: true,
        phone: true,
        website_url: true,
        notes: true,
      },
    });
    if (!campaign) return null;

    const [gallery, checklist, categoryAuditCount, galleryTokenCount] = await Promise.all([
      galleryEligibilityService
        .resolveEligibility(campaignId, ctx)
        .catch(() => null),
      PlaybookChecklistService.getIncompleteRequiredSteps(campaignId, ctx).catch(() => []),
      prisma.mkt_audits_list
        .count({ where: { campaign_id: campaignId, platform: 'category_identification' } })
        .catch(() => 0),
      prisma.mkt_deliverable_preview_tokens
        .count({
          where: {
            campaign_id: campaignId,
            token_type: { in: ['diagnostic_gallery', 'multi_diagnostic_gallery'] },
            converted_at: null,
            paid_at: null,
            expires_at: { gt: new Date() },
          },
        })
        .catch(() => 0),
    ]);

    const acts = cascade?.acts ?? [];

    return deriveStageAdvice({
      campaignId,
      stage: campaign.stage ?? null,
      scope: campaign.scope ?? null,
      categoryIdentified: categoryAuditCount > 0,
      hasBusinessAnalysisAudit: gallery?.hasBusinessAnalysisAudit ?? false,
      hasAcceptedTriage: gallery?.hasAcceptedTriage ?? false,
      hasDeclaredPlaybook: gallery?.hasDeclaredPlaybook ?? false,
      archetypeResolved: !!gallery?.archetype,
      hasContact: !!(campaign.phone || campaign.website_url),
      operationalVerified: (campaign.notes ?? '').includes(OPERATIONAL_VERIFIED_MARKER),
      seedStatus: cascade?.seedStatus ?? null,
      announceDelivered: !!cascade?.announceDeliveredAt,
      act1Cleared: !!cascade?.gate.act1Cleared,
      act1Missing: cascade?.gate.missing ?? [],
      act2Done: acts[1]?.status === 'done',
      act3Cleared: !!cascade?.gate.act3Cleared,
      galleryEligible: !!gallery?.eligible,
      galleryReason: gallery?.reason ?? null,
      galleryAction: gallery?.action ?? null,
      galleryTokenLive: galleryTokenCount > 0,
      checklistIncomplete: checklist.map((s) => ({ id: s.id, title: s.title })),
    });
  }
}

export default StageAdviceService.getInstance();
