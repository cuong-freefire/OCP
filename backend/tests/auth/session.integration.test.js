import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('refresh rotates token and logout revokes active refresh token', async () => {
  const { app, repository } = createTestContext();
  const { user, password } = await createActiveLocalUser(repository, { email: 'session@example.com' });

  const login = await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(200);
  const firstCookies = login.headers['set-cookie'];
  const firstRefresh = [...repository.refreshTokens.values()][0];

  const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', firstCookies).expect(200);
  assert.ok(repository.refreshTokens.get(firstRefresh.id).revokedAt);
  assert.equal([...repository.refreshTokens.values()].length, 2);

  await request(app).post('/api/auth/logout').set('Cookie', refreshed.headers['set-cookie']).expect(200);
  assert.equal([...repository.refreshTokens.values()].filter((token) => !token.revokedAt).length, 0);
});
