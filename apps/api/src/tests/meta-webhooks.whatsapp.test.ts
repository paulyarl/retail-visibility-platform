/**
 * Meta webhook — WhatsApp routing + raw-byte signature tests (§17)
 *
 * Pins the §4.1 security contract and the whatsapp_business_account branch:
 * - X-Hub-Signature-256 verified over the exact raw request bytes
 * - fail closed: missing secret/signature/raw body → 401
 * - object === 'whatsapp_business_account' + field === 'messages' → inbound service
 * - non-messages fields skipped; other objects keep existing behavior
 * - transient inbound failure → 500 so Meta retries
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

const { mockInbound, mockLogger, SECRET } = vi.hoisted(() => ({
  mockInbound: { handleChange: vi.fn() },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  SECRET: 'test-app-secret',
}));

vi.mock('../logger', () => ({ logger: mockLogger }));
vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    metaAppSecret: SECRET,
    metaWebhookVerifyToken: 'verify-tok',
  },
}));
vi.mock('../prisma', () => ({ prisma: {} }));
vi.mock('../services/whatsapp/WhatsAppInboundService', () => ({
  default: { getInstance: () => mockInbound },
}));

import metaWebhookRoutes from '../routes/meta-webhooks';

// Mirror bootstrap.ts §6: path-scoped raw-body capture, then the router.
function buildApp(captureRawBody = true) {
  const app = express();
  const metaWebhookJson = express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      if (captureRawBody) req.rawBody = buf;
    },
  });
  app.use(
    '/api',
    (req, res, next) => (req.path === '/meta/webhooks' ? metaWebhookJson(req, res, next) : next()),
    metaWebhookRoutes,
  );
  return app;
}

function sign(payload: object): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(JSON.stringify(payload)).digest('hex');
}

function waPayload(changes: any[]) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-1', changes }] };
}

const MESSAGES_CHANGE = {
  field: 'messages',
  value: {
    metadata: { phone_number_id: 'pn-1' },
    contacts: [{ wa_id: '15551234567' }],
    messages: [{ id: 'wamid.1', from: '15551234567', type: 'text', text: { body: 'hi' } }],
  },
};

describe('POST /api/meta/webhooks — signature gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInbound.handleChange.mockResolvedValue(undefined);
  });

  it('rejects a missing signature with 401', async () => {
    const res = await request(buildApp()).post('/api/meta/webhooks').send(waPayload([MESSAGES_CHANGE]));
    expect(res.status).toBe(401);
    expect(mockInbound.handleChange).not.toHaveBeenCalled();
  });

  it('rejects a bad signature with 401', async () => {
    const res = await request(buildApp())
      .post('/api/meta/webhooks')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send(waPayload([MESSAGES_CHANGE]));
    expect(res.status).toBe(401);
    expect(mockInbound.handleChange).not.toHaveBeenCalled();
  });

  it('rejects a signature computed over different bytes (tampered body)', async () => {
    const signed = waPayload([MESSAGES_CHANGE]);
    const res = await request(buildApp())
      .post('/api/meta/webhooks')
      .set('X-Hub-Signature-256', sign(signed))
      .send(waPayload([{ ...MESSAGES_CHANGE, value: { ...MESSAGES_CHANGE.value, tampered: true } }]));
    expect(res.status).toBe(401);
    expect(mockInbound.handleChange).not.toHaveBeenCalled();
  });

  it('fails closed when raw body capture is absent → 401', async () => {
    const payload = waPayload([MESSAGES_CHANGE]);
    const res = await request(buildApp(false))
      .post('/api/meta/webhooks')
      .set('X-Hub-Signature-256', sign(payload))
      .send(payload);
    expect(res.status).toBe(401);
    expect(mockInbound.handleChange).not.toHaveBeenCalled();
  });
});

describe('POST /api/meta/webhooks — WhatsApp routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInbound.handleChange.mockResolvedValue(undefined);
  });

  async function post(payload: object) {
    return request(buildApp())
      .post('/api/meta/webhooks')
      .set('X-Hub-Signature-256', sign(payload))
      .send(payload);
  }

  it('routes messages changes to the inbound service and returns 200', async () => {
    const res = await post(waPayload([MESSAGES_CHANGE]));
    expect(res.status).toBe(200);
    expect(mockInbound.handleChange).toHaveBeenCalledTimes(1);
    expect(mockInbound.handleChange).toHaveBeenCalledWith(MESSAGES_CHANGE.value);
  });

  it('processes every messages change across batched entries', async () => {
    const change2 = { field: 'messages', value: { metadata: { phone_number_id: 'pn-2' }, messages: [] } };
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        { id: 'waba-1', changes: [MESSAGES_CHANGE] },
        { id: 'waba-1', changes: [change2] },
      ],
    };
    const res = await post(payload);
    expect(res.status).toBe(200);
    expect(mockInbound.handleChange).toHaveBeenCalledTimes(2);
  });

  it('skips non-messages fields inside a whatsapp_business_account payload', async () => {
    const res = await post(waPayload([
      { field: 'account_update', value: { event: 'PHONE_NUMBER_NAME_UPDATE' } },
      MESSAGES_CHANGE,
    ]));
    expect(res.status).toBe(200);
    expect(mockInbound.handleChange).toHaveBeenCalledTimes(1);
  });

  it('returns 200 for a status-only messages value (service ignores it)', async () => {
    const res = await post(waPayload([
      { field: 'messages', value: { metadata: { phone_number_id: 'pn-1' }, statuses: [{ status: 'read' }] } },
    ]));
    expect(res.status).toBe(200);
  });

  it('does not route other object types to the inbound service', async () => {
    const res = await post({
      object: 'page',
      entry: [{ id: 'pg-1', changes: [{ field: 'feed', value: {} }] }],
    });
    expect(res.status).toBe(200);
    expect(mockInbound.handleChange).not.toHaveBeenCalled();
  });

  it('returns 500 when intake throws (Meta will retry; dedupe makes it safe)', async () => {
    mockInbound.handleChange.mockRejectedValue(new Error('db down'));
    const res = await post(waPayload([MESSAGES_CHANGE]));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/meta/webhooks — verification challenge', () => {
  it('echoes hub.challenge for a valid verify token', async () => {
    const res = await request(buildApp())
      .get('/api/meta/webhooks')
      .query({ 'hub.mode': 'subscribe', 'hub.challenge': 'challenge-123', 'hub.verify_token': 'verify-tok' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('challenge-123');
  });

  it('rejects a wrong verify token with 403', async () => {
    const res = await request(buildApp())
      .get('/api/meta/webhooks')
      .query({ 'hub.mode': 'subscribe', 'hub.challenge': 'x', 'hub.verify_token': 'wrong' });
    expect(res.status).toBe(403);
  });
});
