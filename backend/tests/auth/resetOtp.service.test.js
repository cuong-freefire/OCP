import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('reset OTP locks after failed attempts', async () => {
  const { app, repository } = createTestContext();
  await createActiveLocalUser(repository, { email: 'reset-lock@example.com' });
  await request(app).post('/api/auth/forgot-password').send({ email: 'reset-lock@example.com' }).expect(200);

  for (let index = 0; index < 5; index += 1) {
    await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset-lock@example.com', otp: '000000', newPassword: 'NewPassword123' })
      .expect(401);
  }

  const user = await repository.findUserByEmail('reset-lock@example.com');
  const latest = await repository.findLatestResetOtp(user.id);
  assert.equal(latest.failedAttempts, 5);
  assert.ok(latest.lockedAt);
});

test('reset OTP resend invalidates older code', async () => {
  const { app, emailService } = createTestContext({ env: { RESET_OTP_RESEND_COOLDOWN_SECONDS: '0' } });
  await createActiveLocalUser(app.locals.authService.repository, { email: 'reset-resend@example.com' });
  await request(app).post('/api/auth/forgot-password').send({ email: 'reset-resend@example.com' }).expect(200);
  const firstOtp = emailService.latest('reset').otp;

  await request(app).post('/api/auth/forgot-password').send({ email: 'reset-resend@example.com' }).expect(200);
  await request(app)
    .post('/api/auth/reset-password')
    .send({ email: 'reset-resend@example.com', otp: firstOtp, newPassword: 'NewPassword123' })
    .expect(401);
});
