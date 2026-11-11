'use strict';
// A burst of requests from one user past an expired cache asks auth once, and the
// auth call carries a timeout signal.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppGate } = require('../appAccess');

test('concurrent checks for one user share one auth lookup, with a timeout signal', async () => {
  let calls = 0, sawSignal = false;
  const fetchImpl = async (_url, opts) => {
    calls++; sawSignal = !!opts.signal;
    await new Promise(r => setTimeout(r, 15));
    return { ok: true, status: 200, json: async () => ({ allowed: true }) };
  };
  const gate = createAppGate({ authUrl: 'http://x', slug: 's', fetchImpl });
  const req = () => ({ user: { username: 'u1' }, get: () => undefined, originalUrl: '/' });
  let passed = 0;
  await Promise.all([1, 2, 3, 4].map(() => gate(req(), {}, () => { passed++; })));
  assert.equal(calls, 1);
  assert.equal(passed, 4);
  assert.ok(sawSignal);
});
