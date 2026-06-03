import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('me returns safe current user projection', async () => {
  const { app, repository } = createTestContext();
  const { user, password } = await createActiveLocalUser(repository, { email: 'me@example.com' });

  const login = await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(200);
  const response = await request(app).get('/api/auth/me').set('Cookie', login.headers['set-cookie']).expect(200);

  assert.equal(response.body.data.user.email, user.email);
  assert.equal(response.body.data.user.hasLocalPassword, true);
  assert.equal(response.body.data.user.passwordHash, undefined);
});
