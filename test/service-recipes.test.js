'use strict';
// The assistant's recipe API and the one-off import. Run through the real app.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitchen-service-'));
process.env.DB_PATH = path.join(dir, 'kitchen.db');
process.env.ADMIN_USERNAME = 'chef';
process.env.KITCHEN_SERVICE_TOKEN = 'test-token';
delete process.env.SERVICE_DEFAULT_OWNER;
delete process.env.MIGRATE_VISIBILITY;

const { app } = require('../index.js');
const { Recipe, sequelize, initDatabase } = require('../database');
const { RECIPES, seedDefaultRecipes } = require('../recipes-seed');
const { normalizeIngredients } = require('../lib/recipe-ingredients');
const { run, parseArgs } = require('../scripts/migrate-from-shopper');
const sqlite3 = require('sqlite3');

let server; let base;
before(async () => {
  await initDatabase();
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => { server.close(r); server.closeAllConnections(); });
  await sequelize.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => { await Recipe.destroy({ where: { source: ['service', 'copy', 'text', 'shopper:1', 'shopper:2', 'shopper:3', 'shopper:4', 'shopper:5', 'shopper:6', 'shopper:7'] } }); });

async function call(method, p, { user, body, token = 'test-token' } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(token ? { 'X-Service-Token': token } : {}),
      ...(user ? { 'X-Service-User': user } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const dish = (over) => ({ title: 'Test dish', ingredients: [{ qty: '1 1/2 cups', item: 'flour' }], instructions: 'Mix.', ...over });

test('every ingredient shape becomes name, quantity, unit', () => {
  assert.deepStrictEqual(normalizeIngredients([
    { item: 'flour', qty: '1 1/2 cups' }, { name: 'salt', qty: 'to taste' }, { name: 'egg', quantity: 2, unit: '' },
    { name: 'milk', measure: '½ cup' }, '2 cups rice', { qty: '1' }, null,
  ]), [
    { name: 'flour', quantity: '1 1/2', unit: 'cups' }, { name: 'salt', quantity: 'to taste', unit: '' },
    { name: 'egg', quantity: '2', unit: '' }, { name: 'milk', quantity: '1/2', unit: 'cup' },
    { name: 'rice', quantity: '2', unit: 'cups' },
  ]);
});

test('no token or a wrong one is refused, on every route', async () => {
  for (const token of [null, 'nope']) {
    for (const [m, p] of [['GET', '/api/recipes'], ['GET', '/api/recipes/1'], ['POST', '/api/recipes'], ['PATCH', '/api/recipes/1'],
      ['POST', '/api/recipes/1/edit'], ['POST', '/api/recipes/1/visibility'], ['GET', '/api/public-recipes'], ['POST', '/api/public-recipes/1/copy']]) {
      assert.strictEqual((await call(m, p, { token, user: 'chef' })).status, 401, `${m} ${p}`);
    }
  }
});

test('a saved recipe is the named user\'s, private, and readable back', async () => {
  const made = await call('POST', '/api/recipes', { user: 'sam', body: dish({ tags: 'High Protein, high-protein', sourceUrl: 'https://example.com/x' }) });
  assert.strictEqual(made.status, 201);
  assert.strictEqual(made.json.title, 'Test dish');
  const row = await Recipe.findByPk(made.json.id);
  assert.strictEqual(row.owner, 'sam');
  assert.strictEqual(row.visibility, 'private');
  assert.strictEqual(row.sourceUrl, 'https://example.com/x');
  const list = await call('GET', '/api/recipes?tag=high-protein', { user: 'sam' });
  assert.deepStrictEqual(list.json.recipes.map((r) => [r.id, r.tags]), [[row.id, 'high-protein']]);
  assert.strictEqual((await call('GET', '/api/recipes?q=zzz', { user: 'sam' })).json.recipes.length, 0);
  const got = await call('GET', `/api/recipes/${row.id}`, { user: 'sam' });
  assert.deepStrictEqual(got.json.recipe.ingredients, [{ name: 'flour', quantity: '1 1/2', unit: 'cups' }]);
});

test('another user\'s private recipe is 404 to read, edit, publish and copy', async () => {
  const { json: { id } } = await call('POST', '/api/recipes', { user: 'sam', body: dish() });
  for (const [m, p, body] of [['GET', `/api/recipes/${id}`], ['PATCH', `/api/recipes/${id}`, { title: 'x' }],
    ['POST', `/api/recipes/${id}/edit`, { title: 'x' }], ['POST', `/api/recipes/${id}/visibility`, { visibility: 'public' }], ['POST', `/api/public-recipes/${id}/copy`]]) {
    assert.strictEqual((await call(m, p, { user: 'pat', body })).status, 404, p);
  }
  assert.strictEqual((await call('GET', '/api/recipes', { user: 'pat' })).json.recipes.length, 0);
  assert.strictEqual((await Recipe.findByPk(id)).title, 'Test dish');
});

test('publishing: a member\'s waits for review, the reviewer\'s is public', async () => {
  const mine = (await call('POST', '/api/recipes', { user: 'sam', body: dish() })).json.id;
  const asked = await call('POST', `/api/recipes/${mine}/visibility`, { user: 'sam', body: { visibility: 'public' } });
  assert.deepStrictEqual([asked.json.visibility, asked.json.reviewStatus], ['private', 'pending']);
  const theirs = (await call('POST', '/api/recipes', { user: 'chef', body: dish({ title: 'Chef dish' }) })).json.id;
  const done = await call('POST', `/api/recipes/${theirs}/visibility`, { user: 'chef', body: { visibility: 'public' } });
  assert.deepStrictEqual([done.json.visibility, done.json.reviewStatus], ['public', 'approved']);
  const pub = await call('GET', '/api/public-recipes?q=chef dish', { user: 'sam' });
  assert.deepStrictEqual(pub.json.recipes.map((r) => [r.id, r.mine, r.ingredientCount]), [[theirs, false, 1]]);
  const copy = await call('POST', `/api/public-recipes/${theirs}/copy`, { user: 'sam' });
  const row = await Recipe.findByPk(copy.json.id);
  assert.deepStrictEqual([row.owner, row.visibility, row.copiedFrom], ['sam', 'private', theirs]);
  assert.strictEqual((await call('POST', `/api/public-recipes/${theirs}/copy`)).status, 400, 'a copy must say whose');
});

test('an edit cannot blank a recipe, and a member\'s edit leaves the public site', async () => {
  const row = await Recipe.create({ title: 'Pub', ingredients: '[{"name":"rice"}]', instructions: 'Cook', owner: 'sam', visibility: 'public', source: 'text' });
  assert.strictEqual((await call('PATCH', `/api/recipes/${row.id}`, { user: 'sam', body: { ingredients: [] } })).status, 400);
  const ok = await call('PATCH', `/api/recipes/${row.id}`, { user: 'sam', body: { ingredientsText: '2 cups rice' } });
  assert.deepStrictEqual([ok.json.visibility, ok.json.reviewStatus], ['private', 'pending']);
  await row.reload();
  assert.strictEqual(row.instructions, 'Cook');
});

test('seed: another user\'s same title does not keep a house recipe out, and a rerun adds nothing', async () => {
  const title = RECIPES[0].title;
  await Recipe.destroy({ where: { title } });
  await Recipe.create({ title, ingredients: '[]', owner: 'sam', source: 'text' });
  await seedDefaultRecipes(Recipe);
  assert.strictEqual(await Recipe.count({ where: { title, source: 'seed', visibility: 'public' } }), 1);
  const n = await Recipe.count();
  await seedDefaultRecipes(Recipe);
  assert.strictEqual(await Recipe.count(), n);
});

// ── Import ───────────────────────────────────────────────────────────────────
function snapshot(name, rows) {
  const file = path.join(dir, name);
  const db = new sqlite3.Database(file);
  return new Promise((resolve, reject) => db.serialize(() => {
    db.run('CREATE TABLE recipes (id INTEGER PRIMARY KEY, title TEXT, servings INTEGER, ingredients TEXT, instructions TEXT, keepsForDays INTEGER, tags TEXT, source TEXT, sourceUrl TEXT, sourceContent TEXT, owner TEXT, visibility TEXT, copiedFrom INTEGER, copiedFromAuthor TEXT, createdAt TEXT, updatedAt TEXT)');
    for (const r of rows) db.run('INSERT INTO recipes (id,title,ingredients,instructions,owner,visibility,sourceUrl,createdAt) VALUES (?,?,?,?,?,?,?,?)', [r.id, r.title, r.ingredients || '[{"item":"flour","qty":"1 cup"}]', r.instructions || 'Do it.', r.owner, r.visibility || 'private', r.sourceUrl, '2026-05-31 12:00:00.000 +00:00']);
    db.close((e) => (e ? reject(e) : resolve(file)));
  }));
}
const migrate = async (file, ...args) => {
  const lines = [];
  const r = await run([`--from-db=${file}`, ...args], { Recipe, log: (l) => lines.push(l) });
  return { ...r, text: lines.join('\n') };
};
const seeded = () => ({ title: RECIPES[1].title, ingredients: JSON.stringify(RECIPES[1].ingredients), instructions: RECIPES[1].instructions });

test('import: dry run writes nothing; apply keeps owner and visibility; rerun adds nothing', async () => {
  const file = await snapshot('a.db', [
    { id: 1, title: 'Only there', owner: 'chef', sourceUrl: 'https://example.com/d' },
    { id: 2, title: 'Shared title', owner: 'chef' },
    { id: 3, title: 'Shared title', owner: 'sam' },          // another person, same title and content
    { id: 4, title: 'Member published', owner: 'sam', visibility: 'public' },
    { id: 5, title: 'Chef published', owner: 'chef', visibility: 'public' },
    { id: 6, title: 'No owner', owner: null },
    { id: 7, ...seeded(), owner: 'chef' },                    // the house copy
  ]);
  const before = await Recipe.count();
  const dry = await migrate(file);
  assert.strictEqual(await Recipe.count(), before);
  assert.match(dry.text, /TO ADD: 6/);
  assert.match(dry.text, /#1 {2}Only there/);
  assert.match(dry.text, /DRY RUN/);

  const done = await migrate(file, '--apply');
  assert.strictEqual(done.added, 6);
  const rows = await Recipe.findAll({ where: { source: [1, 2, 3, 4, 5, 6].map((n) => `shopper:${n}`) }, order: [['source', 'ASC']] });
  assert.deepStrictEqual(rows.map((r) => [r.title, r.owner, r.visibility, r.reviewStatus]), [
    ['Only there', 'chef', 'private', null], ['Shared title', 'chef', 'private', null], ['Shared title', 'sam', 'private', null],
    ['Member published', 'sam', 'private', 'pending'], ['Chef published', 'chef', 'public', 'approved'], ['No owner', null, 'private', null],
  ]);
  assert.strictEqual(rows[0].ingredients, '[{"name":"flour","quantity":"1","unit":"cup"}]');
  assert.strictEqual(rows[0].sourceUrl, 'https://example.com/d');
  assert.strictEqual(rows[0].createdAt.toISOString(), '2026-05-31T12:00:00.000Z');

  // Renamed here since: still the same row, and not touched.
  await rows[0].update({ title: 'Renamed here', instructions: 'Mine now.' });
  const again = await migrate(file, '--apply', '--include-differing');
  assert.strictEqual(again.added, 0);
  assert.strictEqual(await Recipe.count(), before + 6);
  await rows[0].reload();
  assert.strictEqual(rows[0].instructions, 'Mine now.');
});

test('import: same owner, same title, different content is reported and opt-in', async () => {
  const house = await Recipe.findOne({ where: { title: RECIPES[1].title, source: 'seed' } });
  const file = await snapshot('b.db', [{ id: 1, title: house.title, owner: 'chef', instructions: 'My own way.' }]);
  const first = await migrate(file, '--apply');
  assert.strictEqual(first.added, 0);
  assert.match(first.text, /DIFFERENT CONTENT[^\n]*: 1/);
  assert.strictEqual((await migrate(file, '--apply', '--include-differing')).added, 1);
  const kept = await Recipe.findByPk(house.id);
  assert.strictEqual(kept.instructions, house.instructions);
});

test('import: --ids, --private, an unreadable ingredient list, and a leftover backup table', async () => {
  const file = await snapshot('c.db', [
    { id: 1, title: 'Wanted', owner: 'chef', visibility: 'public', ingredients: '{broken' }, { id: 2, title: 'Not wanted', owner: 'chef' },
  ]);
  await new Promise((r) => { const db = new sqlite3.Database(file); db.exec('CREATE TABLE recipes_backup AS SELECT * FROM recipes', () => db.close(r)); });
  const done = await migrate(file, '--apply', '--ids=1', '--private');
  assert.strictEqual(done.added, 1);
  assert.match(done.text, /recipes_backup with 2 rows/);
  const row = await Recipe.findOne({ where: { source: 'shopper:1' } });
  assert.strictEqual(row.visibility, 'private');
  assert.match(row.ingredients, /broken/, 'nothing is thrown away');
  assert.throws(() => parseArgs(['--aply']), /unknown option/);
  assert.throws(() => parseArgs(['--dry-run', '--apply']));
});

test('import over the service API: one account, visibility from the published list', async () => {
  process.env.SHOPPER_URL = 'http://source.test'; process.env.SHOPPER_SERVICE_TOKEN = 't';
  const answers = {
    '/api/recipes': { recipes: [{ id: 1, title: 'Api one' }, { id: 2, title: 'Api two' }] },
    '/api/public-recipes': { recipes: [{ id: 2, mine: true }, { id: 9, mine: false }] },
    '/api/recipes/1': { recipe: { id: 1, title: 'Api one', ingredients: [{ name: 'rice', measure: '2 cups' }], instructions: 'a' } },
    '/api/recipes/2': { recipe: { id: 2, title: 'Api two', ingredients: [{ name: 'egg', quantity: 1, unit: '' }], instructions: 'b' } },
  };
  const asked = new Set();
  const fetchImpl = async (u, o) => {
    asked.add(o.headers['X-Service-User']);
    const body = answers[new URL(u).pathname];
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  };
  const r = await run(['--user=sam', '--apply'], { Recipe, log: () => {}, fetchImpl });
  assert.strictEqual(r.added, 2);
  assert.deepStrictEqual([...asked], ['sam']);
  const two = await Recipe.findOne({ where: { source: 'shopper:2' } });
  assert.deepStrictEqual([two.owner, two.visibility, two.reviewStatus], ['sam', 'private', 'pending']);
  const one = await Recipe.findOne({ where: { source: 'shopper:1' } });
  assert.strictEqual(one.ingredients, '[{"name":"rice","quantity":"2","unit":"cups"}]');
});
