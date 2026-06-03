import assert from 'node:assert/strict';
import test from 'node:test';
import { createActiveLocalUser, createTestContext } from '../helpers/authTestApp.js';

test('role authorization allows matching role and rejects mismatches', async () => {
  const { app, repository } = createTestContext();
  const { user } = await createActiveLocalUser(repository, { email: 'role@example.com' });
  const service = app.locals.authService;

  const allowed = await service.requireRole(user.id, ['LEARNER']);
  assert.equal(allowed.role, 'LEARNER');
  await assert.rejects(() => service.requireRole(user.id, ['ADMIN']), /Forbidden/);
});
