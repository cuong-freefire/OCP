import test from 'node:test';
import request from 'supertest';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('auth middleware rejects missing and blocked sessions', async () => {
  const { app, repository } = createTestContext();
  await request(app).get('/api/auth/me').expect(401);

  const { user, password } = await createActiveLocalUser(repository, { email: 'middleware@example.com' });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(200);
  repository.users.get(user.id).status = 'blocked';
  await request(app).get('/api/auth/me').set('Cookie', login.headers['set-cookie']).expect(401);
});
