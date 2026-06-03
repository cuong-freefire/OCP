import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('Google verified email links to existing active user without duplicate', async () => {
  const { app, repository } = createTestContext({
    google: {
      configured: true,
      claims: {
        sub: 'existing-google-sub',
        email: 'existing-google@example.com',
        emailVerified: true,
        name: 'Existing Google',
      },
    },
  });
  await createActiveLocalUser(repository, { email: 'existing-google@example.com' });

  await request(app).post('/api/auth/google').send({ credential: 'provider-token' }).expect(200);

  const users = [...repository.users.values()].filter((user) => user.email === 'existing-google@example.com');
  assert.equal(users.length, 1);
  assert.equal(repository.oauthAccounts.size, 1);
});
