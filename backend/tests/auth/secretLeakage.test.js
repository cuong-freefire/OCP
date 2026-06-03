import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('responses do not expose token, cookie, OTP, password hash, or secret fields', async () => {
  const { app } = createTestContext();
  const register = await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Secret User', email: 'secret@example.com', password: 'Password123' })
    .expect(201);
  const body = JSON.stringify(register.body);

  assert.equal(body.includes('passwordHash'), false);
  assert.equal(body.includes('otp'), false);
  assert.equal(body.includes('ocp_access_token'), false);
  assert.equal(body.includes('test-auth-secret'), false);
});
