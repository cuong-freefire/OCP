import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('verification OTP locks after maximum failed attempts', async () => {
  const { app, repository } = createTestContext();
  await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Lock User', email: 'lock@example.com', password: 'Password123' })
    .expect(201);

  for (let index = 0; index < 5; index += 1) {
    await request(app).post('/api/auth/verify-email').send({ email: 'lock@example.com', otp: '000000' }).expect(401);
  }

  const user = await repository.findUserByEmail('lock@example.com');
  const latest = await repository.findLatestVerificationOtp(user.id);
  assert.equal(latest.failedAttempts, 5);
  assert.ok(latest.lockedAt);
});

test('resend invalidates older verification OTP', async () => {
  const { app, repository, emailService } = createTestContext({ env: { EMAIL_OTP_RESEND_COOLDOWN_SECONDS: '0' } });
  await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Resend User', email: 'resend@example.com', password: 'Password123' })
    .expect(201);
  const firstOtp = emailService.latest('verification').otp;

  await request(app).post('/api/auth/resend-verification').send({ email: 'resend@example.com' }).expect(200);
  await request(app).post('/api/auth/verify-email').send({ email: 'resend@example.com', otp: firstOtp }).expect(401);

  const user = await repository.findUserByEmail('resend@example.com');
  assert.equal(user.status, 'pending_verification');
});
