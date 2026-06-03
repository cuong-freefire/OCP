import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('authenticated Google-only user can set first local password', async () => {
  const { app, repository } = createTestContext({ google: { configured: true } });
  const login = await request(app).post('/api/auth/google').send({ credential: 'provider-token' }).expect(200);

  await request(app)
    .post('/api/auth/set-password')
    .set('Cookie', login.headers['set-cookie'])
    .send({ newPassword: 'LocalPassword123' })
    .expect(200);

  const user = await repository.findUserByEmail('google@example.com');
  assert.ok(user.passwordHash);
});
