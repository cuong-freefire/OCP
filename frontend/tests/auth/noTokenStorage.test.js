import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

test('frontend Auth source does not persist JWT or attach bearer tokens', () => {
  const srcDir = fileURLToPath(new URL('../../src', import.meta.url));
  const source = collectFiles(srcDir)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('Authorization: Bearer'), false);
});
