import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('frontend Auth API uses CRA env contract only', () => {
  const source = readFileSync(new URL('../../src/api/authApi.js', import.meta.url), 'utf8');

  assert.match(source, /REACT_APP_API_BASE_URL/);
  assert.equal(source.includes('VITE_'), false);
  assert.equal(source.includes('REACT_API_URL'), false);
});
