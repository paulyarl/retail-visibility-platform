/**
 * Data Migration Script: Legacy prospects CSV → Marketing Ops campaigns
 *
 * Imports campaign data from a CSV file into the mkt_campaigns_list table.
 * Reconstructs stage history from date columns. Idempotent via display_id
 * dedup — re-running skips campaigns that already have the same display_id.
 *
 * CSV expected columns (header row required, case-insensitive):
 *   business_name, category, city, neighborhood, contact_method, contact_info,
 *   gbp_claimed (true/false), unaddressed_reviews, last_review_date (YYYY-MM-DD),
 *   has_website (working/broken/none), nap_consistent (true/false),
 *   estimated_tier (tier_1/tier_2/tier_3), estimated_fee (decimal),
 *   pain_score (0-10), stage, date_entered, date_preview_built, date_shown,
 *   date_paid, date_delivered, date_retainer_pitched, date_retainer_won,
 *   amount_paid (decimal), retainer_status, retainer_amount (decimal),
 *   notes, assigned_to
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/migrate-marketing-ops-data.ts --csv=./legacy_prospects.csv
 *
 * Or via package.json:
 *   pnpm migrate:mkt-data -- --csv=./legacy_prospects.csv
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { generateCampaignId, generateStageHistoryId } from '../lib/id-generator';
import { logger } from '../logger';

const prisma = new PrismaClient();

interface LegacyRow {
  business_name?: string;
  category?: string;
  city?: string;
  neighborhood?: string;
  contact_method?: string;
  contact_info?: string;
  gbp_claimed?: string;
  unaddressed_reviews?: string;
  last_review_date?: string;
  has_website?: string;
  nap_consistent?: string;
  estimated_tier?: string;
  estimated_fee?: string;
  pain_score?: string;
  stage?: string;
  date_entered?: string;
  date_preview_built?: string;
  date_shown?: string;
  date_paid?: string;
  date_delivered?: string;
  date_retainer_pitched?: string;
  date_retainer_won?: string;
  amount_paid?: string;
  retainer_status?: string;
  retainer_amount?: string;
  notes?: string;
  assigned_to?: string;
  display_id?: string;
}

const STAGE_ORDER = [
  'seek',
  'preview_built',
  'shown',
  'paid',
  'delivered',
  'retainer_pitched',
  'retainer_won',
];

const STAGE_DATE_MAP: Record<string, string> = {
  preview_built: 'date_preview_built',
  shown: 'date_shown',
  paid: 'date_paid',
  delivered: 'date_delivered',
  retainer_pitched: 'date_retainer_pitched',
  retainer_won: 'date_retainer_won',
};

function parseCsv(filePath: string): LegacyRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: LegacyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() || undefined;
    });
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseDate(value?: string): Date | null {
  if (!value || value.trim() === '') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseBoolean(value?: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
}

function parseDecimalToCents(value?: string): number {
  if (!value || value.trim() === '') return 0;
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function normalizeStage(stage?: string): string {
  if (!stage) return 'seek';
  const normalized = stage.toLowerCase().trim().replace(/\s+/g, '_');
  if (STAGE_ORDER.includes(normalized) || normalized === 'lost' || normalized === 'dead') {
    return normalized;
  }
  return 'seek';
}

function generateDisplayId(city: string, category: string, sequence: number): string {
  const cityCode = city.substring(0, 3).toUpperCase();
  const catCode = category.substring(0, 2).toUpperCase();
  return `${cityCode}_${catCode}_${String(sequence).padStart(3, '0')}`;
}

async function reconstructStageHistory(
  campaignId: string,
  row: LegacyRow,
  finalStage: string,
  changedBy: string
): Promise<void> {
  const transitions: Array<{ from: string | null; to: string; date: Date | null }> = [];

  let prevStage: string | null = null;
  for (const stage of STAGE_ORDER) {
    const dateField = STAGE_DATE_MAP[stage];
    const date = parseDate(row[dateField as keyof LegacyRow] as string);
    if (date) {
      transitions.push({ from: prevStage, to: stage, date });
      prevStage = stage;
    }
  }

  if (transitions.length === 0 && finalStage !== 'seek') {
    transitions.push({ from: null, to: finalStage, date: parseDate(row.date_entered) || new Date() });
  }

  for (const t of transitions) {
    await prisma.mkt_stage_history_list.create({
      data: {
        id: generateStageHistoryId(),
        campaign_id: campaignId,
        from_stage: t.from,
        to_stage: t.to,
        changed_by: changedBy,
        changed_at: t.date || new Date(),
        trigger_type: 'system',
        notes: 'Migrated from legacy data',
      },
    });
  }
}

async function main() {
  const csvArg = process.argv.find((a) => a.startsWith('--csv='));
  if (!csvArg) {
    logger.error('Usage: migrate-marketing-ops-data.ts --csv=./path/to/file.csv');
    process.exit(1);
  }
  const csvPath = csvArg.split('=')[1];
  if (!fs.existsSync(csvPath)) {
    logger.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const changedBy = process.argv.find((a) => a.startsWith('--user='))?.split('=')[1] || 'system';
  const dryRun = process.argv.includes('--dry-run');

  logger.info(`Starting migration from CSV: ${csvPath}`, undefined, { dryRun });

  const rows = parseCsv(csvPath);
  logger.info(`Parsed ${rows.length} rows from CSV`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let seq = 1;

  // Get current max sequence for display_id generation
  const existingCampaigns = await prisma.mkt_campaigns_list.findMany({
    select: { display_id: true },
    where: { display_id: { not: null } },
  });
  const existingDisplayIds = new Set(existingCampaigns.map((c) => c.display_id));

  for (const row of rows) {
    try {
      if (!row.business_name || !row.category || !row.city) {
        logger.warn(`Skipping row ${seq}: missing required fields (business_name, category, city)`);
        errors++;
        continue;
      }

      const displayId = row.display_id || generateDisplayId(row.city, row.category, seq);
      if (existingDisplayIds.has(displayId)) {
        logger.info(`Skipping duplicate: ${displayId} (${row.business_name})`);
        skipped++;
        seq++;
        continue;
      }

      const finalStage = normalizeStage(row.stage);
      const campaignId = generateCampaignId();

      const dateEntered = parseDate(row.date_entered) || new Date();
      const estimatedFeeCents = parseDecimalToCents(row.estimated_fee);
      const amountPaidCents = parseDecimalToCents(row.amount_paid);
      const retainerAmountCents = parseDecimalToCents(row.retainer_amount);

      if (dryRun) {
        logger.info(`[DRY RUN] Would create: ${displayId} - ${row.business_name} (${finalStage})`);
        created++;
        seq++;
        continue;
      }

      const campaign = await prisma.mkt_campaigns_list.create({
        data: {
          id: campaignId,
          display_id: displayId,
          business_name: row.business_name,
          category: row.category,
          city: row.city,
          neighborhood: row.neighborhood || null,
          contact_method: row.contact_method || null,
          contact_info: row.contact_info || null,
          gbp_claimed: parseBoolean(row.gbp_claimed),
          unaddressed_reviews: parseInt(row.unaddressed_reviews || '0', 10) || 0,
          last_review_date: parseDate(row.last_review_date),
          has_website: row.has_website || null,
          nap_consistent: row.nap_consistent ? parseBoolean(row.nap_consistent) : null,
          estimated_tier: row.estimated_tier || null,
          estimated_fee_cents: estimatedFeeCents,
          pain_score: parseInt(row.pain_score || '0', 10) || 0,
          stage: finalStage,
          stage_entered_at: dateEntered,
          date_entered: dateEntered,
          date_preview_built: parseDate(row.date_preview_built),
          date_shown: parseDate(row.date_shown),
          date_paid: parseDate(row.date_paid),
          date_delivered: parseDate(row.date_delivered),
          date_retainer_pitched: parseDate(row.date_retainer_pitched),
          date_retainer_won: parseDate(row.date_retainer_won),
          amount_paid_cents: amountPaidCents,
          retainer_status: row.retainer_status || 'not_pitched',
          retainer_amount_cents: retainerAmountCents,
          retainer_start_date: parseDate(row.date_retainer_won),
          notes: row.notes || null,
          assigned_to: row.assigned_to || null,
          created_by: changedBy,
        },
      });

      await reconstructStageHistory(campaign.id, row, finalStage, changedBy);
      existingDisplayIds.add(displayId);
      created++;
      seq++;
      logger.info(`Created campaign: ${displayId} - ${row.business_name}`);
    } catch (err) {
      logger.error(`Failed to import row ${seq}`, undefined, {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        business_name: row.business_name,
      });
      errors++;
      seq++;
    }
  }

  logger.info(`Migration complete: ${created} created, ${skipped} skipped (duplicates), ${errors} errors`);

  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error('Migration script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
