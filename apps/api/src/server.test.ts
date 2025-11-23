import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from './index';

// Health endpoint should always work without DB

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Routes listing', () => {
  it('GET /__routes returns array', async () => {
    const res = await request(app).get('/__routes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // includes at least /health
    const paths = res.body.map((r: any) => r.path);
    expect(paths).toContain('/health');
  });
});
