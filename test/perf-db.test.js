'use strict';
// SQLite tuning and lookup indexes: WAL + busy_timeout on every connection,
// indexes created idempotently (a second init is a no-op, not an error).
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os'), fs = require('fs'), path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitchen-perf-'));
process.env.DB_PATH = path.join(dir, 'test.db');
const db = require('../database');

test('pragmas apply and indexes exist after init, twice', async () => {
  await db.initDatabase();
  await db.initDatabase();
  const q = sql => db.sequelize.query(sql, { type: 'SELECT' });
  assert.equal((await q('PRAGMA journal_mode'))[0].journal_mode, 'wal');
  assert.equal((await q('PRAGMA busy_timeout'))[0].timeout, 5000);
  const names = (await q("SELECT name FROM sqlite_master WHERE type='index'")).map(r => r.name);
  for (const n of ['idx_recipes_owner']) assert.ok(names.includes(n), 'missing index ' + n);
  await db.sequelize.close();
});
