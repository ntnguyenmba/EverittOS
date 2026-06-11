import assert from 'node:assert/strict';

const timeoutMs = 30 * 60 * 1000;
const recent = new Date().toISOString();
const stale = new Date(Date.now() - timeoutMs - 1000).toISOString();

function isSessionIdle(lastActivityIso, now = Date.now()) {
  if (!lastActivityIso) return true;
  const ts = Date.parse(lastActivityIso);
  if (Number.isNaN(ts)) return true;
  return now - ts > timeoutMs;
}

assert.equal(isSessionIdle(recent), false);
assert.equal(isSessionIdle(stale), true);
assert.equal(isSessionIdle(undefined), true);

console.log('session policy checks passed');
