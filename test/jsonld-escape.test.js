'use strict';
// A recipe's text must not be able to close the structured-data <script> block on its page.
// Run: node --test test/jsonld-escape.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitchen-jsonld-'));
process.env.DB_PATH = path.join(dir, 'kitchen.db');
process.env.AUTH_SERVICE_URL = 'http://127.0.0.1:9';

const { app } = require('../index');
const { Recipe, sequelize, initDatabase } = require('../database');

let server; let base;
before(async () => {
  await initDatabase();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await sequelize.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('markup in a public recipe cannot break out of the JSON-LD script', async () => {
  const evil = '</script><img src=x onerror=alert(1)>';
  const r = await Recipe.create({
    title: `Soup ${evil}`, servings: 2, owner: 'sam', visibility: 'public',
    ingredients: JSON.stringify([{ name: `salt ${evil}`, quantity: '1', unit: 'tsp' }]),
    instructions: `1. Stir ${evil}`, tags: `x${evil}`, summary: `s${evil}`,
  });
  const res = await fetch(`${base}/recipes/${r.id}`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();
  const ld = html.slice(html.indexOf('application/ld+json'));
  const body = ld.slice(ld.indexOf('>') + 1, ld.indexOf('</script>'));
  assert.doesNotThrow(() => JSON.parse(body), 'the block must be one intact JSON document');
  assert.ok(!/<img src=x onerror/.test(html), 'no injected element anywhere on the page');
});
