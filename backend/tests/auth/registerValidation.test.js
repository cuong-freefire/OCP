import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createTestContext } from '../helpers/authTestApp.js';

test('register rejects frontend role and avatar authority fields', async () => {
  const { app, repository } = createTestContext();

  const response = await request(app)
    .post('/api/auth/register')
    .send({
      fullName: 'Bad Input',
      email: 'bad@example.com',
      password: 'Password123',
      role: 'ADMIN',
      avatarUrl: 'https://example.test/avatar.png',
    })
    .expect(400);

  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.equal(await repository.findUserByEmail('bad@example.com'), null);
});
