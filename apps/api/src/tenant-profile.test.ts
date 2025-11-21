import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { app } from './index';

async function loginOrRegister(email: string, password: string) {
  // Try login first
  let res = await request(app)
    .post('/auth/login')
    .send({ email, password });

  if (res.status === 200) {
    return res.body.accessToken as string;
  }

  // Register then login
  await request(app)
    .post('/auth/register')
    .send({ email, password });

  res = await request(app)
    .post('/auth/login')
    .send({ email, password });

  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

async function createTenant(token: string, name: string) {
  const res = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  expect([201, 200]).toContain(res.status);
  return res.body.id as string;
}

const TEST_EMAIL = 'owner@demo.local';
const TEST_PASSWORD = 'password123';

let token = '';
let tenantId = '';

// Skip tests entirely if API is not connected to a database
const dbAvailable = !!process.env.DATABASE_URL;

(dbAvailable ? describe : describe.skip)('TR-010 Tenant Business Profile API', () => {
  beforeAll(async () => {
    token = await loginOrRegister(TEST_EMAIL, TEST_PASSWORD);
  });

  beforeEach(async () => {
    // Always ensure we have a tenant for isolation; using unique name to avoid collisions
    const name = `Test Tenant ${Date.now()}`;
    tenantId = await createTenant(token, name);
  });

  it('rejects invalid phone number on POST', async () => {
    const res = await request(app)
      .post('/tenant/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: tenantId,
        business_name: 'My Shop',
        address_line1: '123 Main',
        city: 'City',
        postal_code: '12345',
        country_code: 'US',
        phone_number: '12345', // not E.164
        email: 'store@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_payload');
  });

  it('creates profile on POST and returns normalized GET', async () => {
    const postRes = await request(app)
      .post('/tenant/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: tenantId,
        business_name: 'My Shop',
        address_line1: '123 Main',
        city: 'City',
        postal_code: '12345',
        country_code: 'US',
        phone_number: '+12025550123',
        email: 'store@example.com',
        website: 'https://example.com'
      });

    expect(postRes.status).toBe(200);

    const getRes = await request(app)
      .get('/tenant/profile')
      .set('Authorization', `Bearer ${token}`)
      .query({ tenantId: tenantId });

    expect(getRes.status).toBe(200);
    expect(getRes.body.tenantId).toBe(tenantId);
    expect(getRes.body.businessName).toBe('My Shop');
    expect(getRes.body.phone_number).toBe('+12025550123');
  });

  it('updates profile on PATCH and syncs tenant name', async () => {
    // Seed minimal profile first
    await request(app)
      .post('/tenant/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: tenantId,
        business_name: 'Original Name',
        address_line1: '123 Main',
        city: 'City',
        postal_code: '12345',
        country_code: 'US'
      });

    // Update name via PATCH
    const patchRes = await request(app)
      .patch('/tenant/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: tenantId, business_name: 'Updated Name' });

    expect(patchRes.status).toBe(200);

    // Verify tenant name synced
    const tenantRes = await request(app)
      .get(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(tenantRes.status).toBe(200);
    expect(tenantRes.body.name).toBe('Updated Name');
  });
});
