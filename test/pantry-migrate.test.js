'use strict';
// Pantry tables: created on an existing database, nothing rebuilt or lost, columns only added.
const { test } = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { definePantryModels, createAdditively } = require('../lib/pantry-models');

test('create, rerun, and add a missing column without touching rows', async () => {
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const m = definePantryModels(db);
  for (const x of Object.values(m)) await createAdditively(x);
  await m.PantryItem.create({ owner: 'alpha', name: 'Yogurt' });
  await db.query('ALTER TABLE pantry_items DROP COLUMN notes'); // an older live table
  const sql = [];
  db.options.logging = q => sql.push(q);
  for (const x of Object.values(m)) await createAdditively(x);
  assert.strictEqual((await m.PantryItem.findAll()).length, 1);
  assert.strictEqual((await m.PantryItem.findOne()).notes, null);
  assert.ok(!sql.some(q => /DROP|_backup/i.test(q)), 'no table rebuild');
  await db.close();
});
