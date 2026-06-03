import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Auth API client sends browser credentials', () => {
  const source = readFileSync(new URL('../../src/api/authApi.js', import.meta.url), 'utf8');

  assert.match(source, /credentials:\s*'include'/);
  assert.match(source, /withCredentials\s*=\s*true/);
});
