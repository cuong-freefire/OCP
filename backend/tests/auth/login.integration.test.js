import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('local login sets cookies and returns safe user data', async () => {
  const { app, repository } = createTestContext();
  const { user, password } = await createActiveLocalUser(repository, { email: 'login@example.com' });

  const response = await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(200);

  assert.match(response.headers['set-cookie'].join(';'), /HttpOnly/);
  assert.equal(response.body.data.user.email, user.email);
  assert.equal(response.body.data.user.passwordHash, undefined);
});
