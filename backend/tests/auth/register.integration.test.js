import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('register creates pending learner, sends OTP, and does not set session cookies', async () => {
  const { app, repository, emailService } = createTestContext();

  const response = await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Ada Learner', email: 'Ada@Example.com ', password: 'Password123' })
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.name, 'Ada Learner');
  assert.equal(response.body.data.user.role, 'LEARNER');
  assert.equal(response.headers['set-cookie'], undefined);

  const user = await repository.findUserByEmail('ada@example.com');
  assert.equal(user.status, 'pending_verification');
  assert.equal(user.emailVerified, false);
  assert.equal(user.avatarUrl, null);
  assert.equal(emailService.latest('verification').otp.length, 6);
});
