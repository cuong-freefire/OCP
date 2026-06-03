import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Google sign-in uses provider credential flow and no raw credential prompt', () => {
  const source = readFileSync(new URL('../../src/components/auth/GoogleSignInButton.jsx', import.meta.url), 'utf8');

  assert.match(source, /accounts\.id\.renderButton/);
  assert.match(source, /loginWithCredential\(response\.credential\)/);
  assert.equal(source.includes('requires the provider flow configured by the backend'), false);
  assert.equal(source.includes('paste'), false);
  assert.equal(source.includes('password'), false);
});
