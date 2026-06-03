import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('reset OTP is not created for unknown, blocked, deleted, or Google-only users', async () => {
  const { app, repository } = createTestContext();
  await createActiveLocalUser(repository, { email: 'blocked-reset@example.com', status: 'blocked' });
  await createActiveLocalUser(repository, { email: 'deleted-reset@example.com', deletedAt: new Date() });
  repository.createUser({ email: 'google-reset@example.com', passwordHash: null, status: 'active', emailVerified: true });

  await request(app).post('/api/auth/forgot-password').send({ email: 'unknown-reset@example.com' }).expect(200);
  await request(app).post('/api/auth/forgot-password').send({ email: 'blocked-reset@example.com' }).expect(200);
  await request(app).post('/api/auth/forgot-password').send({ email: 'deleted-reset@example.com' }).expect(200);
  await request(app).post('/api/auth/forgot-password').send({ email: 'google-reset@example.com' }).expect(200);

  assert.equal(repository.resetOtps.size, 0);
});
