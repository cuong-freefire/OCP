import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('verify email activates pending user and sets httpOnly auth cookies', async () => {
  const { app, repository, emailService } = createTestContext();
  await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Verify User', email: 'verify@example.com', password: 'Password123' })
    .expect(201);

  const otp = emailService.latest('verification').otp;
  const response = await request(app)
    .post('/api/auth/verify-email')
    .send({ email: 'verify@example.com', otp })
    .expect(200);

  const cookies = response.headers['set-cookie'].join(';');
  assert.match(cookies, /ocp_access_token=.*HttpOnly/);
  assert.match(cookies, /ocp_refresh_token=.*HttpOnly/);

  const user = await repository.findUserByEmail('verify@example.com');
  assert.equal(user.status, 'active');
  assert.equal(user.emailVerified, true);
});
