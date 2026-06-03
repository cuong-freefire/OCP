import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('forgot password uses non-enumerating public response', async () => {
  const { app, repository, emailService } = createTestContext();
  await createActiveLocalUser(repository, { email: 'resettable@example.com' });

  const eligible = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'resettable@example.com' })
    .expect(200);
  const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' }).expect(200);

  assert.equal(eligible.body.message, unknown.body.message);
  assert.equal(emailService.latest('reset').to, 'resettable@example.com');
});
