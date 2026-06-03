import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('auth errors use sanitized response contract', async () => {
  const { app } = createTestContext();
  const response = await request(app).post('/api/auth/login').send({ email: 'none@example.com', password: 'bad' }).expect(401);

  assert.equal(response.body.success, false);
  assert.equal(typeof response.body.message, 'string');
  assert.equal(typeof response.body.code, 'string');
  assert.equal(response.body.stack, undefined);
});
