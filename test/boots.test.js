'use strict';
// The estate rule: every Node service must evaluate its entrypoint under test.
// A suite that imports only the pieces can be green while index.js throws at
// module load (e.g. a const used before its require) — which is not a broken
// page but a container that never starts. Requiring the entrypoint here catches
// exactly that.
const { test } = require('node:test');
const assert = require('node:assert');

test('index.js loads without throwing and exports the app', () => {
  const mod = require('../index.js');
  assert.strictEqual(typeof mod.app, 'function', 'exports an express app');
  assert.strictEqual(typeof mod.start, 'function', 'exports start()');
});

test('safe-temp matcher surfaces the right temps', () => {
  const { relevantTemps } = require('../safe-temps');
  const chicken = relevantTemps({ title: 'Chicken fried rice', ingredients: [{ name: 'chicken thigh' }, { name: 'eggs' }] });
  assert.ok(chicken.some((t) => t.tempF === 165), 'chicken → 165°F');
  // "chicken broth" alone must NOT trigger a poultry callout.
  const broth = relevantTemps({ title: 'Beef stew', ingredients: [{ name: 'chicken broth' }, { name: 'ground beef' }] });
  assert.ok(!broth.some((t) => t.food.startsWith('Poultry')), 'chicken broth is not poultry');
  assert.ok(broth.some((t) => t.tempF === 160), 'ground beef → 160°F');
});
