import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('reset password consumes OTP and updates bcrypt hash', async () => {
  const { app, repository, emailService } = createTestContext();
  await createActiveLocalUser(repository, { email: 'reset-success@example.com', password: 'OldPassword123' });
  await request(app).post('/api/auth/forgot-password').send({ email: 'reset-success@example.com' }).expect(200);
  const otp = emailService.latest('reset').otp;

  await request(app)
    .post('/api/auth/reset-password')
    .send({ email: 'reset-success@example.com', otp, newPassword: 'NewPassword123' })
    .expect(200);
  await request(app).post('/api/auth/login').send({ email: 'reset-success@example.com', password: 'NewPassword123' }).expect(200);

  const user = await repository.findUserByEmail('reset-success@example.com');
  const latest = await repository.findLatestResetOtp(user.id);
  assert.equal(latest, undefined);
});
