import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('Google login rejects blocked users and does not persist raw OAuth tokens', async () => {
  const { app, repository } = createTestContext({
    google: {
      configured: true,
      claims: {
        sub: 'blocked-google-sub',
        email: 'blocked-google@example.com',
        emailVerified: true,
        name: 'Blocked Google',
      },
    },
  });
  await createActiveLocalUser(repository, { email: 'blocked-google@example.com', status: 'blocked' });

  await request(app).post('/api/auth/google').send({ credential: 'raw-oauth-token' }).expect(401);

  assert.equal(repository.oauthAccounts.size, 0);
});
