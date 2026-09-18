/**
 * IdentityEvidenceService — the WRITE path for the Identity Packet ledger.
 *
 * The packet (IdentityPacketService) is a DERIVED view: every ledger row comes
 * from an audit, the owner website, audit corroboration sources, attribute
 * chips, or directory_field_provenance. A business with no audit yet therefore
 * renders an empty ledger and scores 0 on both axes — the normal state right
 * after a prospect call, and the reason the Identity tab reads "Blocked".
 *
 * This service is the missing operator write path: record a source as evidence
 * becomes available ("owner confirmed the address on the phone"; "GBP page
 * found"; "checked the SNAP retailer list"). The packet picks the rows up on
 * the next assembly.
 *
 * Three responsibilities:
 *   1. Scope — rows are shared across a business prospect group, so one
 *      verification call covers every sibling archetype. Falls back to the
 *      campaign when the campaign has no business_prospect_id.
 *   2. Owner identity — a row may carry the owner's name / phone / email. It is
 *      not an identity-scoring field, but it is the source for owner outreach
 *      and is expensive to re-gather, so it is captured once here and back-filled
 *      onto the prospect group's campaign records (fill-if-empty, never
 *      overwriting) where the outreach tooling already reads it.
 *   3. Provenance mirror — when the campaign has a linked primary seed, the
 *      corroborated fields are mirrored into directory_field_provenance so the
 *      public listing and the seed intelligence report inherit the source.
 *      The mirror never clobbers an existing provenance row (DO NOTHING), and
 *      rows it created are marked with EVIDENCE_PROVENANCE_NOTE so removing the
 *      evidence can retract exactly what it wrote.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import {
  generateDirectoryFieldProvenanceId,
  generateIdentityEvidenceId,
} from '../lib/id-generator';
import {
  inferSourceTier,
  isIdentityEvidenceState,
  isIdentityFieldKey,
  isIdentitySourceTier,
  sourceGroupSlug,
  type IdentityEvidenceState,
  type IdentityFieldKey,
  type IdentitySourceTier,
} from './directory/identityScoring';

/** Marker on mirrored provenance rows — lets a delete retract only our rows. */
export const EVIDENCE_PROVENANCE_NOTE = 'Identity tab operator evidence';

/** Provenance confidence implied by the source's authority tier. */
const PROVENANCE_CONFIDENCE: Record<IdentitySourceTier, string> = {
  authoritative: 'high',
  first_party: 'high',
  major_aggregator: 'medium',
  secondary_aggregator: 'low',
  inferred: 'low',
};

export interface IdentityEvidenceInput {
  campaignId: string;
  sourceName: string;
  sourceUrl?: string | null;
  /** Omit to infer from the source name (see inferSourceTier). */
  tier?: IdentitySourceTier | null;
  evidenceState?: IdentityEvidenceState | null;
  /** Fields this source corroborates. May be empty when owner contact is given. */
  corroborates?: IdentityFieldKey[];
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  accessedAt?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface IdentityEvidenceRow {
  id: string;
  campaignId: string | null;
  businessProspectId: string | null;
  sourceName: string;
  sourceUrl: string | null;
  tier: IdentitySourceTier;
  independenceGroup: string;
  evidenceState: IdentityEvidenceState;
  corroborates: IdentityFieldKey[];
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  accessedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  /** True when the row was captured on a sibling campaign in the same group. */
  shared: boolean;
}

/** Owner contact carried by the newest evidence row that has any. */
export interface OwnerContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Evidence row the contact came from — the provenance for the capture. */
  sourceName: string;
  evidenceId: string;
  capturedAt: string | null;
}

export interface IdentityEvidenceScope {
  campaignId: string;
  businessProspectId: string | null;
}

/** `YYYY-MM-DD` or null — the column is a DATE, so never carry a time. */
function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return m ? m[1] : null;
}

const clean = (v: string | null | undefined): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

class IdentityEvidenceService {
  /**
   * Resolve the sharing scope for a campaign: the business prospect group when
   * the campaign belongs to one, else the campaign itself.
   */
  async resolveScope(campaignId: string): Promise<IdentityEvidenceScope> {
    const rows = await prisma.$queryRaw<Array<{ business_prospect_id: string | null }>>`
      SELECT business_prospect_id FROM mkt_campaigns_list WHERE id = ${campaignId} LIMIT 1
    `;
    return { campaignId, businessProspectId: rows[0]?.business_prospect_id ?? null };
  }

  /**
   * Evidence visible to a campaign: its own rows plus every sibling's rows in
   * the same prospect group, newest first.
   */
  async listForCampaign(campaignId: string): Promise<IdentityEvidenceRow[]> {
    const scope = await this.resolveScope(campaignId);
    const rows = scope.businessProspectId
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM mkt_identity_evidence
          WHERE business_prospect_id = ${scope.businessProspectId}
             OR campaign_id = ${campaignId}
          ORDER BY created_at DESC
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM mkt_identity_evidence
          WHERE campaign_id = ${campaignId}
          ORDER BY created_at DESC
        `;
    return (Array.isArray(rows) ? rows : []).map((r) => this.toRow(r, campaignId));
  }

  /**
   * Record a source. Returns the stored row.
   *
   * `corroborates` is intersected with the known field keys, and the tier falls
   * back to inference from the source name so an unrecognized source can never
   * claim authority it was not given.
   */
  async create(input: IdentityEvidenceInput): Promise<IdentityEvidenceRow> {
    const scope = await this.resolveScope(input.campaignId);
    const corroborates = [
      ...new Set((input.corroborates ?? []).filter((f): f is IdentityFieldKey => isIdentityFieldKey(f))),
    ];
    const ownerName = clean(input.ownerName);
    const ownerPhone = clean(input.ownerPhone);
    const ownerEmail = clean(input.ownerEmail);

    if (corroborates.length === 0 && !ownerName && !ownerPhone && !ownerEmail) {
      throw new Error('evidence_empty: corroborate at least one field or capture owner contact');
    }

    const tier = isIdentitySourceTier(input.tier) ? input.tier : inferSourceTier(input.sourceName);
    const evidenceState: IdentityEvidenceState = isIdentityEvidenceState(input.evidenceState)
      ? input.evidenceState
      : 'observed';
    const id = generateIdentityEvidenceId();
    const accessedAt = toDateOnly(input.accessedAt);

    await prisma.$executeRaw`
      INSERT INTO mkt_identity_evidence (
        id, campaign_id, business_prospect_id, source_name, source_url, tier,
        independence_group, evidence_state, corroborates,
        owner_name, owner_phone, owner_email,
        accessed_at, notes, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${scope.campaignId}, ${scope.businessProspectId}, ${input.sourceName},
        ${clean(input.sourceUrl)}, ${tier}, ${sourceGroupSlug(input.sourceName) || 'manual'},
        ${evidenceState}, ${corroborates}::text[],
        ${ownerName}, ${ownerPhone}, ${ownerEmail},
        ${accessedAt}, ${clean(input.notes)}, ${input.createdBy ?? null}, now(), now()
      )
    `;

    if (corroborates.length > 0) {
      await this.mirrorToProvenance(scope, {
        sourceName: input.sourceName,
        sourceUrl: clean(input.sourceUrl),
        tier,
        evidenceState,
        accessedAt,
        corroborates,
      });
    }

    if (ownerName || ownerPhone || ownerEmail) {
      await this.reuseOwnerContact(scope, { ownerName, ownerPhone, ownerEmail });
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_identity_evidence WHERE id = ${id} LIMIT 1
    `;
    return this.toRow(rows[0], input.campaignId);
  }

  /** Remove a source and retract the provenance rows it mirrored in. */
  async remove(id: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_identity_evidence WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return false;

    await prisma.$executeRaw`DELETE FROM mkt_identity_evidence WHERE id = ${id}`;

    if (Array.isArray(row.corroborates) && row.corroborates.length > 0) {
      try {
        const links = await prisma.$queryRaw<any[]>`
          SELECT dps.id AS seed_id
          FROM directory_seed_campaign_links dscl
          JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
          WHERE dscl.campaign_id = ${row.campaign_id} AND dscl.link_role = 'primary'
          LIMIT 1
        `;
        const seedId = links[0]?.seed_id;
        if (seedId) {
          // Only rows this service wrote carry the marker — an upsert by another
          // writer changes source_name/notes and is therefore left alone.
          await prisma.$executeRaw`
            DELETE FROM directory_field_provenance
            WHERE seed_id = ${seedId}
              AND source_name = ${row.source_name}
              AND notes = ${EVIDENCE_PROVENANCE_NOTE}
              AND field_key = ANY(${row.corroborates}::text[])
          `;
        }
      } catch (error) {
        logger.warn('IdentityEvidence: provenance retraction failed (non-fatal)', undefined, {
          id,
          error: (error as Error).message,
        });
      }
    }

    return true;
  }

  // ─── Provenance mirror ───────────────────────────────────────────────────

  /**
   * Mirror the corroborated fields onto the linked seed's provenance, so the
   * public listing and the intelligence report inherit the source.
   *
   * INSERT ... DO NOTHING: an existing provenance row for the field is stronger
   * evidence (an audit or the owner) and is never replaced. Values come from the
   * assembled packet, so the row records the resolved value the source supports
   * rather than a duplicate of the canonicalization logic. `show_on_public` is
   * left false — publishing operator evidence stays a deliberate step.
   */
  private async mirrorToProvenance(
    scope: IdentityEvidenceScope,
    source: {
      sourceName: string;
      sourceUrl: string | null;
      tier: IdentitySourceTier;
      evidenceState: IdentityEvidenceState;
      accessedAt: string | null;
      corroborates: IdentityFieldKey[];
    },
  ): Promise<void> {
    try {
      const links = await prisma.$queryRaw<any[]>`
        SELECT dps.id AS seed_id, dps.tenant_id
        FROM directory_seed_campaign_links dscl
        JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
        WHERE dscl.campaign_id = ${scope.campaignId} AND dscl.link_role = 'primary'
        LIMIT 1
      `;
      const link = links[0];
      if (!link) return;

      // Dynamic import — IdentityPacketService reads this service's rows, so a
      // static import would be a cycle.
      const { default: IdentityPacketService } = await import('./IdentityPacketService');
      const packet = await IdentityPacketService.buildForCampaign(scope.campaignId);
      const resolvedValues = new Map(packet.fields.map((f) => [f.field, f.value]));

      for (const field of source.corroborates) {
        await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value, source_name, source_url,
            accessed_at, confidence, show_on_public, evidence_state, notes,
            created_at, updated_at
          ) VALUES (
            ${generateDirectoryFieldProvenanceId(link.tenant_id)},
            ${link.seed_id},
            ${link.tenant_id},
            ${field},
            ${resolvedValues.get(field) ?? null},
            ${source.sourceName},
            ${source.sourceUrl},
            ${source.accessedAt},
            ${PROVENANCE_CONFIDENCE[source.tier]},
            false,
            ${source.evidenceState},
            ${EVIDENCE_PROVENANCE_NOTE},
            now(), now()
          )
          ON CONFLICT (seed_id, field_key) DO NOTHING
        `;
      }
    } catch (error) {
      logger.warn('IdentityEvidence: provenance mirror failed (non-fatal)', undefined, {
        campaignId: scope.campaignId,
        error: (error as Error).message,
      });
    }
  }

  // ─── Owner identity reuse ────────────────────────────────────────────────

  /**
   * Back-fill the captured owner contact onto every campaign in the scope
   * (the prospect group, or the single campaign), filling only empty slots.
   *
   * This is the "capture once, reuse anytime" half: outreach reads the campaign
   * record (`owner_names` / `phones` / `email` / `phone`) — the opener merge
   * context, the campaign form, and sibling creation all key off it — so the
   * contact has to land there, not just in the evidence ledger. Existing values
   * are never overwritten: a verified value on file outranks a new capture.
   */
  private async reuseOwnerContact(
    scope: IdentityEvidenceScope,
    contact: { ownerName: string | null; ownerPhone: string | null; ownerEmail: string | null },
  ): Promise<void> {
    try {
      const campaigns = scope.businessProspectId
        ? await prisma.$queryRaw<any[]>`
            SELECT id, owner_names, phones, email, phone FROM mkt_campaigns_list
            WHERE business_prospect_id = ${scope.businessProspectId} OR id = ${scope.campaignId}
          `
        : await prisma.$queryRaw<any[]>`
            SELECT id, owner_names, phones, email, phone FROM mkt_campaigns_list
            WHERE id = ${scope.campaignId}
          `;

      for (const campaign of Array.isArray(campaigns) ? campaigns : []) {
        const ownerNames: string[] = Array.isArray(campaign.owner_names) ? campaign.owner_names : [];
        const phones: Array<{ label?: string; number?: string }> = Array.isArray(campaign.phones)
          ? campaign.phones
          : [];

        const nextOwnerNames =
          contact.ownerName &&
          !ownerNames.some((n) => String(n).toLowerCase() === contact.ownerName!.toLowerCase())
            ? [...ownerNames, contact.ownerName]
            : null;
        const nextPhones =
          contact.ownerPhone &&
          !phones.some((p) => String(p?.number ?? '').replace(/\D/g, '').slice(-10) === contact.ownerPhone!.replace(/\D/g, '').slice(-10))
            ? [...phones, { label: 'owner', number: contact.ownerPhone }]
            : null;
        const nextEmail = contact.ownerEmail && !clean(campaign.email) ? contact.ownerEmail : null;
        const nextPhone = contact.ownerPhone && !clean(campaign.phone) ? contact.ownerPhone : null;

        if (!nextOwnerNames && !nextPhones && !nextEmail && !nextPhone) continue;

        await prisma.$executeRaw`
          UPDATE mkt_campaigns_list SET
            owner_names = COALESCE(${nextOwnerNames ? JSON.stringify(nextOwnerNames) : null}::jsonb, owner_names),
            phones = COALESCE(${nextPhones ? JSON.stringify(nextPhones) : null}::jsonb, phones),
            email = COALESCE(${nextEmail}, email),
            phone = COALESCE(${nextPhone}, phone),
            updated_at = now()
          WHERE id = ${campaign.id}
        `;
      }
    } catch (error) {
      logger.warn('IdentityEvidence: owner-contact reuse failed (non-fatal)', undefined, {
        campaignId: scope.campaignId,
        error: (error as Error).message,
      });
    }
  }

  // ─── Mapping ─────────────────────────────────────────────────────────────

  private toRow(row: any, viewerCampaignId: string): IdentityEvidenceRow {
    return {
      id: row.id,
      campaignId: row.campaign_id ?? null,
      businessProspectId: row.business_prospect_id ?? null,
      sourceName: row.source_name,
      sourceUrl: row.source_url ?? null,
      tier: isIdentitySourceTier(row.tier) ? row.tier : inferSourceTier(row.source_name),
      independenceGroup: row.independence_group ?? sourceGroupSlug(row.source_name) ?? 'manual',
      evidenceState: isIdentityEvidenceState(row.evidence_state) ? row.evidence_state : 'observed',
      corroborates: (Array.isArray(row.corroborates) ? row.corroborates : []).filter(isIdentityFieldKey),
      ownerName: row.owner_name ?? null,
      ownerPhone: row.owner_phone ?? null,
      ownerEmail: row.owner_email ?? null,
      accessedAt: row.accessed_at
        ? row.accessed_at instanceof Date
          ? row.accessed_at.toISOString().slice(0, 10)
          : String(row.accessed_at).slice(0, 10)
        : null,
      notes: row.notes ?? null,
      createdBy: row.created_by ?? null,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
      shared: row.campaign_id != null && row.campaign_id !== viewerCampaignId,
    };
  }
}

export default new IdentityEvidenceService();
export { IdentityEvidenceService };
