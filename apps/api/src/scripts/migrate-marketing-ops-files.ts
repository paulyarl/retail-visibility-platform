/**
 * File Migration Script: Legacy local folders → Marketing Ops file storage
 *
 * Scans a local directory tree for legacy marketing files and imports them
 * into the mkt_files_list table. Files are copied to the platform's upload
 * directory under `marketing-ops/{campaignId}/`. Uses display_id or
 * business_name matching to associate files with campaigns.
 *
 * Expected directory structure:
 *   {rootDir}/{display_id_or_business_name}/{file_type}/file.pdf
 *
 * Where file_type is one of: preview, paid_deliverable, runsheet, invoice, audit_output
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/migrate-marketing-ops-files.ts --dir=./legacy_files
 *
 * Or via package.json:
 *   pnpm migrate:mkt-files -- --dir=./legacy_files
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { generateMarketingFileId } from '../lib/id-generator';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const VALID_FILE_TYPES = [
  'preview',
  'paid_deliverable',
  'runsheet',
  'invoice',
  'audit_output',
];

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: number;
  unmatched: string[];
}

async function findCampaignByDirName(dirName: string): Promise<{ id: string; displayId: string | null } | null> {
  // Try matching by display_id first (e.g., "AUS_AD_001")
  const byDisplayId = await prisma.mkt_campaigns_list.findFirst({
    where: { display_id: dirName },
    select: { id: true, display_id: true },
  });
  if (byDisplayId) return byDisplayId;

  // Try matching by business_name (case-insensitive)
  const byName = await prisma.mkt_campaigns_list.findFirst({
    where: {
      business_name: { contains: dirName, mode: 'insensitive' },
    },
    select: { id: true, display_id: true },
  });
  if (byName) return byName;

  // Try directory name as a substring of business_name
  const byNameContains = await prisma.mkt_campaigns_list.findFirst({
    where: {
      business_name: { contains: dirName.replace(/_/g, ' '), mode: 'insensitive' },
    },
    select: { id: true, display_id: true },
  });
  if (byNameContains) return byNameContains;

  return null;
}

function scanDirectory(dirPath: string): Array<{ filePath: string; fileType: string; fileName: string }> {
  const results: Array<{ filePath: string; fileType: string; fileName: string }> = [];

  if (!fs.existsSync(dirPath)) {
    logger.error(`Directory not found: ${dirPath}`);
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Check if this directory name is a file_type
      const fileType = entry.name.toLowerCase().replace(/\s+/g, '_');
      if (VALID_FILE_TYPES.includes(fileType)) {
        // This is a file_type directory — scan for files inside
        const files = fs.readdirSync(entryPath, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile()) {
            results.push({
              filePath: path.join(entryPath, file.name),
              fileType,
              fileName: file.name,
            });
          }
        }
      } else {
        // This might be a campaign directory — recurse
        results.push(...scanDirectory(entryPath));
      }
    } else if (entry.isFile()) {
      // File directly in this directory — infer type from filename
      const ext = path.extname(entry.name).toLowerCase();
      if (MIME_MAP[ext]) {
        const inferredType = inferFileType(entry.name);
        results.push({
          filePath: entryPath,
          fileType: inferredType,
          fileName: entry.name,
        });
      }
    }
  }

  return results;
}

function inferFileType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('preview')) return 'preview';
  if (lower.includes('paid') || lower.includes('deliverable')) return 'paid_deliverable';
  if (lower.includes('runsheet') || lower.includes('run_sheet')) return 'runsheet';
  if (lower.includes('invoice')) return 'invoice';
  if (lower.includes('audit')) return 'audit_output';
  return 'audit_output';
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

async function migrateFile(
  filePath: string,
  fileType: string,
  fileName: string,
  campaignId: string,
  uploadDir: string,
  changedBy: string
): Promise<boolean> {
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const destDir = path.join(uploadDir, 'marketing-ops', campaignId);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(filePath, destPath);

    const storagePath = `/uploads/marketing-ops/${campaignId}/${fileName}`;

    await prisma.mkt_files_list.create({
      data: {
        id: generateMarketingFileId(),
        campaign_id: campaignId,
        file_type: fileType,
        file_name: fileName,
        storage_path: storagePath,
        file_size: fileSize,
        mime_type: getMimeType(fileName),
        uploaded_by: changedBy,
      },
    });

    logger.info(`Migrated file: ${fileName} → campaign ${campaignId} (${fileType})`);
    return true;
  } catch (err) {
    logger.error(`Failed to migrate file: ${fileName}`, undefined, {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
    return false;
  }
}

async function main() {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='));
  if (!dirArg) {
    logger.error('Usage: migrate-marketing-ops-files.ts --dir=./legacy_files');
    process.exit(1);
  }
  const rootDir = dirArg.split('=')[1];
  if (!fs.existsSync(rootDir)) {
    logger.error(`Root directory not found: ${rootDir}`);
    process.exit(1);
  }

  const changedBy = process.argv.find((a) => a.startsWith('--user='))?.split('=')[1] || 'system';
  const dryRun = process.argv.includes('--dry-run');
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

  logger.info(`Starting file migration from: ${rootDir}`, undefined, { dryRun, uploadDir });

  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    errors: 0,
    unmatched: [],
  };

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const campaignDir = path.join(rootDir, entry.name);
    const campaign = await findCampaignByDirName(entry.name);

    if (!campaign) {
      logger.warn(`No campaign found for directory: ${entry.name}`);
      result.unmatched.push(entry.name);
      result.skipped++;
      continue;
    }

    logger.info(`Processing directory: ${entry.name} → campaign ${campaign.displayId || campaign.id}`);

    const files = scanDirectory(campaignDir);

    for (const file of files) {
      if (dryRun) {
        logger.info(`[DRY RUN] Would migrate: ${file.fileName} (${file.fileType}) → ${campaign.displayId}`);
        result.migrated++;
        continue;
      }

      const success = await migrateFile(
        file.filePath,
        file.fileType,
        file.fileName,
        campaign.id,
        uploadDir,
        changedBy
      );
      if (success) {
        result.migrated++;
      } else {
        result.errors++;
      }
    }
  }

  logger.info(
    `File migration complete: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors} errors`
  );

  if (result.unmatched.length > 0) {
    logger.warn(`Unmatched directories (${result.unmatched.length}):`, undefined, {
      unmatched: result.unmatched,
    });
  }

  await prisma.$disconnect();
  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error('File migration script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
