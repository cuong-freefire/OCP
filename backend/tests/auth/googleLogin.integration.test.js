import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('Google login creates active email-verified learner and sets cookies', async () => {
  const { app, repository } = createTestContext({
    google: {
      configured: true,
      claims: {
        sub: 'new-google-sub',
        email: 'new-google@example.com',
        emailVerified: true,
        name: 'New Google',
        picture: 'https://example.test/picture.png',
      },
    },
  });

  const response = await request(app).post('/api/auth/google').send({ credential: 'provider-token' }).expect(200);
  assert.match(response.headers['set-cookie'].join(';'), /HttpOnly/);

  const user = await repository.findUserByEmail('new-google@example.com');
  assert.equal(user.status, 'active');
  assert.equal(user.emailVerified, true);
  assert.equal(user.passwordHash, null);
});
