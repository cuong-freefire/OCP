import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('local login rejects wrong password, pending, blocked, deleted, and Google-only users', async () => {
  const { app, repository } = createTestContext();
  const active = await createActiveLocalUser(repository, { email: 'wrong@example.com' });
  await createActiveLocalUser(repository, { email: 'blocked@example.com', status: 'blocked' });
  await createActiveLocalUser(repository, { email: 'deleted@example.com', deletedAt: new Date() });
  repository.createUser({ email: 'google-only@example.com', passwordHash: null, status: 'active', emailVerified: true });
  repository.createUser({ email: 'pending@example.com', passwordHash: 'hash', status: 'pending_verification', emailVerified: false });

  await request(app).post('/api/auth/login').send({ email: active.user.email, password: 'bad-password' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'blocked@example.com', password: 'Password123' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'deleted@example.com', password: 'Password123' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'google-only@example.com', password: 'Password123' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'pending@example.com', password: 'Password123' }).expect(401);
});
