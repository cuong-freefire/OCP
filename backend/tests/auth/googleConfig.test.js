import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('Google config endpoint and login fail safely when not configured', async () => {
  const { app } = createTestContext({ google: { configured: false } });

  const config = await request(app).get('/api/auth/google/config').expect(200);
  assert.equal(config.body.data.configured, false);

  const login = await request(app).post('/api/auth/google').send({ credential: 'provider-token' }).expect(503);
  assert.equal(login.body.code, 'GOOGLE_NOT_CONFIGURED');
});
