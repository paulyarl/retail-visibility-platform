/**
 * Marketing Ops diagnostic-screenshot upload — accepted payload shapes
 *
 * Regression: the route only accepted multipart/form-data. The platform's other
 * image flows (seed photos, directory photos, seed logos) post a base64 dataUrl
 * in a JSON body so the browser can re-encode through a canvas first — that
 * re-encode is what strips EXIF and produces honest bytes for a file the browser
 * only typed by extension. This pins both accepted shapes and the shared
 * validation (decode → size cap → declared mime → magic-byte sniff).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockCampaignsList, mockAuditsList, mockFilesList, mockCreateFile, mockSetBriefingTopic, mockStorageUpload } =
  vi.hoisted(() => ({
    mockCampaignsList: { findUnique: vi.fn() },
    mockAuditsList: { findUnique: vi.fn() },
    mockFilesList: { findFirst: vi.fn() },
    mockCreateFile: vi.fn(),
    mockSetBriefingTopic: vi.fn(),
    mockStorageUpload: vi.fn(),
  }));

vi.mock('../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    mkt_files_list: mockFilesList,
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-key',
    recoveryMaxAttachmentBytes: 10 * 1024 * 1024,
  },
}));

vi.mock('../storage-config', () => ({
  StorageBuckets: { DISPUTES: { name: 'disputes', isPublic: false } },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ upload: mockStorageUpload }) } }),
}));

vi.mock('../services/MarketingFileService', () => ({
  default: { createFile: mockCreateFile, setBriefingTopic: mockSetBriefingTopic },
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-001', role: 'PLATFORM_ADMIN' };
    next();
  },
  requirePlatformAdmin: (_req: any, _res: any, next: any) => next(),
}));

import marketingOpsRouter from '../routes/marketing-ops';

const app = express();
app.use(express.json());
app.use('/api/admin/marketing-ops', marketingOpsRouter);

const CAMPAIGN_ID = 'camp-001';
const UPLOAD_URL = `/api/admin/marketing-ops/${CAMPAIGN_ID}/files/upload`;

/** 8-byte PNG magic — enough for the sniff. */
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}`;
/** JPEG SOI + APP0 marker, declared as PNG (the browser types by extension). */
const MISLABELED_DATA_URL = `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaignsList.findUnique.mockResolvedValue({ id: CAMPAIGN_ID, business_prospect_id: null });
  mockStorageUpload.mockResolvedValue({ error: null });
  mockCreateFile.mockResolvedValue({ id: 'mfile-1', file_name: 'shot.png' });
  mockFilesList.findFirst.mockResolvedValue({ id: 'mfile-1' });
  mockSetBriefingTopic.mockResolvedValue({ id: 'mfile-1' });
});

describe('POST /:campaignId/files/upload — JSON dataUrl', () => {
  it('decodes the dataUrl and creates the file row', async () => {
    const res = await request(app)
      .post(UPLOAD_URL)
      .send({ dataUrl: PNG_DATA_URL, contentType: 'image/png', fileName: 'shot.png' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    const [pathKey, buffer, opts] = mockStorageUpload.mock.calls[0];
    expect(String(pathKey)).toContain(`diagnostic-${CAMPAIGN_ID}/`);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(PNG_BYTES.length);
    expect(opts.contentType).toBe('image/png');

    expect(mockCreateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: CAMPAIGN_ID,
        fileType: 'diagnostic_screenshot',
        fileName: 'shot.png',
        fileSize: PNG_BYTES.length,
        mimeType: 'image/png',
      }),
      expect.anything(),
    );
  });

  it('prefers the sniffed mime over a mislabeled declaration', async () => {
    const res = await request(app)
      .post(UPLOAD_URL)
      .send({ dataUrl: MISLABELED_DATA_URL, contentType: 'image/png', fileName: 'shot.png' });

    expect(res.status).toBe(201);
    expect(mockStorageUpload.mock.calls[0][2].contentType).toBe('image/jpeg');
    expect(mockCreateFile.mock.calls[0][0].mimeType).toBe('image/jpeg');
  });

  it('falls back to the mime carried in the data URL when none is declared', async () => {
    const res = await request(app).post(UPLOAD_URL).send({ dataUrl: PNG_DATA_URL });

    expect(res.status).toBe(201);
    expect(mockStorageUpload.mock.calls[0][2].contentType).toBe('image/png');
    expect(mockCreateFile.mock.calls[0][0].fileName).toBe('screenshot');
  });

  it('rejects a malformed dataUrl', async () => {
    const res = await request(app)
      .post(UPLOAD_URL)
      .send({ dataUrl: 'not-a-data-url', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_payload');
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('rejects an unsupported declared mime', async () => {
    const res = await request(app)
      .post(UPLOAD_URL)
      .send({ dataUrl: PNG_DATA_URL, contentType: 'image/gif', fileName: 'x.gif' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_file_type');
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe('POST /:campaignId/files/upload — multipart (legacy shape)', () => {
  it('still accepts a single "file" field', async () => {
    const res = await request(app)
      .post(UPLOAD_URL)
      .attach('file', Buffer.from(PNG_BYTES), { filename: 'shot.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockCreateFile.mock.calls[0][0].fileName).toBe('shot.png');
  });

  it('400s when neither a file nor a dataUrl is supplied', async () => {
    const res = await request(app).post(UPLOAD_URL).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_file');
  });
});

describe('POST /:campaignId/files/upload — briefing topic tag', () => {
  const AUDIT = {
    id: 'maud-1',
    campaign_id: CAMPAIGN_ID,
    platform: 'business_analysis',
    audit_data: {
      outreach_problems: [
        { problem: 'Invisible on Maps', hook: 'h', solution: 'Fix the profile' },
      ],
      benefits: ['Show up first'],
    },
  };

  it('resolves {auditId, kind, index} into a persisted snapshot', async () => {
    mockAuditsList.findUnique.mockResolvedValue(AUDIT);

    const res = await request(app)
      .post(UPLOAD_URL)
      .send({
        dataUrl: PNG_DATA_URL,
        fileName: 'shot.png',
        briefingTopic: { auditId: 'maud-1', kind: 'ammunition', index: 0 },
      });

    expect(res.status).toBe(201);
    expect(mockCreateFile.mock.calls[0][0].briefingTopic).toEqual({
      auditId: 'maud-1',
      auditPlatform: 'business_analysis',
      kind: 'ammunition',
      index: 0,
      label: 'Invisible on Maps',
      detail: { problem: 'Invisible on Maps', hook: 'h', solution: 'Fix the profile' },
    });
  });

  it('400s on an unknown kind before touching storage', async () => {
    mockAuditsList.findUnique.mockResolvedValue(AUDIT);

    const res = await request(app)
      .post(UPLOAD_URL)
      .send({
        dataUrl: PNG_DATA_URL,
        briefingTopic: { auditId: 'maud-1', kind: 'widget', index: 0 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_briefing_topic');
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('400s when the index does not resolve inside the audit briefing', async () => {
    mockAuditsList.findUnique.mockResolvedValue(AUDIT);

    const res = await request(app)
      .post(UPLOAD_URL)
      .send({
        dataUrl: PNG_DATA_URL,
        briefingTopic: { auditId: 'maud-1', kind: 'issue', index: 0 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_briefing_topic');
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('rejects an audit outside the campaign/prospect group', async () => {
    mockAuditsList.findUnique.mockResolvedValue({ ...AUDIT, campaign_id: 'camp-other' });
    // Keyed mock, not a Once chain — the audit-owner lookup only runs when the
    // campaign has a prospect id, so queued values can leak between tests.
    mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id === 'camp-other'
          ? { id: 'camp-other', business_prospect_id: 'prospect-9' }
          : { id: CAMPAIGN_ID, business_prospect_id: 'prospect-7' },
      ),
    );

    const res = await request(app)
      .post(UPLOAD_URL)
      .send({
        dataUrl: PNG_DATA_URL,
        briefingTopic: { auditId: 'maud-1', kind: 'benefit', index: 0 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_briefing_topic');
  });

  it('accepts a sibling audit from the same prospect group (inherited briefing)', async () => {
    mockAuditsList.findUnique.mockResolvedValue({ ...AUDIT, campaign_id: 'camp-primary' });
    mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, business_prospect_id: 'prospect-7' }),
    );

    const res = await request(app)
      .post(UPLOAD_URL)
      .send({
        dataUrl: PNG_DATA_URL,
        briefingTopic: { auditId: 'maud-1', kind: 'benefit', index: 0 },
      });

    expect(res.status).toBe(201);
    expect(mockCreateFile.mock.calls[0][0].briefingTopic.label).toBe('Show up first');
  });
});

describe('PATCH /:campaignId/files/:fileId/topic', () => {
  const TOPIC_URL = `/api/admin/marketing-ops/${CAMPAIGN_ID}/files/mfile-1/topic`;

  it('persists a resolved topic snapshot', async () => {
    mockAuditsList.findUnique.mockResolvedValue({
      id: 'maud-1',
      campaign_id: CAMPAIGN_ID,
      platform: 'website_positioning',
      audit_data: { issues: [{ issue: 'No CTA', conversion_implication: 'Lost calls' }] },
    });

    const res = await request(app)
      .patch(TOPIC_URL)
      .send({ briefingTopic: { auditId: 'maud-1', kind: 'issue', index: 0 } });

    expect(res.status).toBe(200);
    expect(mockSetBriefingTopic).toHaveBeenCalledWith(
      'mfile-1',
      expect.objectContaining({ kind: 'issue', label: 'No CTA' }),
      expect.anything(),
    );
  });

  it('clears the tag on briefingTopic: null', async () => {
    const res = await request(app).patch(TOPIC_URL).send({ briefingTopic: null });

    expect(res.status).toBe(200);
    expect(mockSetBriefingTopic).toHaveBeenCalledWith('mfile-1', null, expect.anything());
    expect(mockAuditsList.findUnique).not.toHaveBeenCalled();
  });

  it('400s on an unresolvable ref', async () => {
    mockAuditsList.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch(TOPIC_URL)
      .send({ briefingTopic: { auditId: 'maud-gone', kind: 'issue', index: 0 } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_briefing_topic');
    expect(mockSetBriefingTopic).not.toHaveBeenCalled();
  });

  it('404s when the file is not a diagnostic screenshot on this campaign', async () => {
    mockFilesList.findFirst.mockResolvedValue(null);

    const res = await request(app).patch(TOPIC_URL).send({ briefingTopic: null });

    expect(res.status).toBe(404);
  });
});
