'use strict';
// The pantry over real HTTP against the real entrypoint, with a stub octopus-auth.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const et = require('../lib/et');

const USERS = { a: { username: 'alpha', userId: 1, role: 'user' }, b: { username: 'beta', userId: 2, role: 'admin' } };
const TOKEN = 'test-service-token';
const TODAY = et.todayET();
const ago = n => et.addDays(TODAY, -n);
const freePort = () => new Promise((ok, no) => {
  const s = net.createServer(); s.once('error', no);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});
let child, auth, base, tmp, log = '';

before(async () => {
  auth = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.startsWith('/api/auth/verify')) {
        const m = /Bearer\s+(\S+)/.exec(req.headers.authorization || '');
        return res.end(JSON.stringify(m && USERS[m[1]] ? { valid: true, user: USERS[m[1]] } : { valid: false }));
      }
      res.end(JSON.stringify({ allowed: true }));
    });
  });
  await new Promise(r => auth.listen(0, '127.0.0.1', r));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-'));
  child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(tmp, 'k.db'), AUTH_SERVICE_URL: `http://127.0.0.1:${auth.address().port}`,
      AUTH_REMOTE_VERIFY: '', KITCHEN_SERVICE_TOKEN: TOKEN, SERVICE_DEFAULT_OWNER: 'alpha' },
  });
  for (const s of [child.stdout, child.stderr]) s.on('data', d => { log += d; });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('did not start: ' + log.slice(0, 2000));
});
after(() => { child?.kill('SIGKILL'); auth?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const get = (url, who, headers = {}) => fetch(base + url, { redirect: 'manual', headers: { ...(who ? { Cookie: `octopus_sso=${who}` } : {}), ...headers } });
const post = (url, who, body = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) for (const x of [].concat(v)) p.append(k, x);
  return fetch(base + url, { method: 'POST', redirect: 'manual', body: p, headers: who ? { Cookie: `octopus_sso=${who}` } : {} });
};
const service = (who, days) => fetch(`${base}/api/service/pantry/expiring${days == null ? '' : `?days=${days}`}`,
  { headers: { 'X-Service-Token': TOKEN, ...(who ? { 'X-Service-User': who } : {}) } });
const idOf = async (name, who) => {
  const html = await (await get('/pantry', who)).text();
  return new RegExp(`/pantry/(\\d+)/edit">${name}`).exec(html)?.[1];
};

test('login is required', async () => {
  for (const u of ['/pantry', '/pantry/new', '/pantry/shelf-life']) assert.strictEqual((await get(u)).status, 302, u);
  assert.strictEqual((await post('/pantry', null, { name: 'x' })).status, 302);
});

test('add, list with an estimate, edit, custom fields, and escape', async () => {
  const r = await post('/pantry', 'a', { name: 'Yogurt', brand: '<b>Any</b>', category: 'yogurt', openedOn: ago(4), kcal: '100', protein: '17', carbs: '6', fat: '0', customName: ['Sodium'], customValue: ['65 mg'] });
  assert.strictEqual(r.status, 302);
  const page = await get('/pantry', 'a');
  assert.strictEqual(page.headers.get('cache-control'), 'private, no-store');
  const html = await page.text();
  assert.match(html, /opened 4 days ago, probably good until/);
  assert.doesNotMatch(html, /<b>Any/);
  const id = await idOf('Yogurt', 'a');
  assert.match(await (await get(`/pantry/${id}/edit`, 'a')).text(), /value="65 mg"/);
  await post(`/pantry/${id}`, 'a', { name: 'Yogurt', category: 'yogurt', openedOn: ago(4), kcal: '110', customName: ['Salt', ''], customValue: ['70 mg', 'gone'] });
  const edited = await (await get(`/pantry/${id}/edit`, 'a')).text();
  assert.match(edited, /value="Salt"/);
  assert.doesNotMatch(edited, /value="Sodium"|value="65 mg"|value="gone"/);
  const bad = await post('/pantry', 'a', { name: 'x', kcal: 'lots' });
  assert.strictEqual(bad.status, 400);
});

test("another user's item is 404 everywhere, admin included", async () => {
  const id = await idOf('Yogurt', 'a');
  assert.ok(id);
  assert.strictEqual((await get(`/pantry/${id}/edit`, 'b')).status, 404);
  assert.strictEqual((await get(`/pantry/new?from=${id}`, 'b')).status, 404);
  for (const verb of ['', '/opened', '/finished', '/spoiled', '/restore', '/delete']) {
    assert.strictEqual((await post(`/pantry/${id}${verb}`, 'b', { name: 'stolen' })).status, 404, verb);
  }
  assert.strictEqual((await post('/pantry/preps', 'b', { name: 'p', madeOn: TODAY, portions: '1', itemId: [id], itemServings: ['1'] })).status, 400);
  assert.doesNotMatch(await (await get('/pantry', 'b')).text(), /Yogurt/);
  assert.ok(await idOf('Yogurt', 'a'), 'still there');
});

test('spoiled today shortens only that user, put back undoes it', async () => {
  const id = await idOf('Yogurt', 'a');
  await post(`/pantry/${id}/spoiled`, 'a');
  await post(`/pantry/${id}/spoiled`, 'a'); // double tap
  const learned = await (await get('/pantry/shelf-life', 'a')).text();
  assert.strictEqual(learned.match(/spoiled 4 days/g).length, 1);
  assert.doesNotMatch(await (await get('/pantry/shelf-life', 'b')).text(), /spoiled 4 days/);
  for (const who of ['a', 'b']) await post('/pantry', who, { name: 'Yogurt', category: 'yogurt', openedOn: TODAY });
  const until = async who => (await (await service(USERS[who].username, 30)).json()).items.find(i => i.name === 'Yogurt').goodUntil;
  assert.strictEqual(await until('a'), et.addDays(TODAY, 3));
  assert.strictEqual(await until('b'), et.addDays(TODAY, 7));
  await post(`/pantry/${id}/restore`, 'a');
  assert.doesNotMatch(await (await get('/pantry/shelf-life', 'a')).text(), /spoiled 4 days/);
  await post(`/pantry/${id}/spoiled`, 'a');
  const oid = /observations\/(\d+)\/delete/.exec(await (await get('/pantry/shelf-life', 'a')).text())[1];
  assert.strictEqual((await post(`/pantry/observations/${oid}/delete`, 'b')).status, 404);
  await post(`/pantry/observations/${oid}/delete`, 'a');
  assert.strictEqual(await until('a'), et.addDays(TODAY, 7));
});

test('opened today sets the date', async () => {
  await post('/pantry', 'a', { name: 'Juice', category: 'juice', boughtOn: ago(2) });
  await post(`/pantry/${await idOf('Juice', 'a')}/opened`, 'a');
  assert.match(await (await get('/pantry', 'a')).text(), /opened today, probably good/);
});

test('a prep totals macros, takes its soonest ingredient, counts down, and is private', async () => {
  await post('/pantry', 'a', { name: 'Powder', category: 'protein_powder', openedOn: ago(10), kcal: '120', protein: '24', carbs: '3', fat: '1' });
  await post('/pantry', 'a', { name: 'Milk', category: 'milk', openedOn: ago(4), kcal: '100', protein: '8', carbs: '12', fat: '2' });
  const ids = [await idOf('Powder', 'a'), await idOf('Milk', 'a')];
  const r = await post('/pantry/preps', 'a', { name: 'Shake', category: 'leftovers', madeOn: TODAY, portions: '2', itemId: [...ids, ''], itemServings: ['4', '2', ''], itemAmount: ['4 scoops', '2 cups', ''] });
  assert.strictEqual(r.status, 302);
  const html = await (await get('/pantry', 'a')).text();
  assert.match(html, /340 kcal · protein 56 g · carbs 18 g · fat 4 g/);
  const prep = (await (await service('alpha', 1)).json()).items.find(i => i.kind === 'prep');
  assert.strictEqual(prep.goodUntil, et.addDays(TODAY, 1));
  assert.match(prep.why, /Milk/);
  for (const verb of ['portions', 'finished', 'spoiled', 'restore', 'delete']) {
    assert.strictEqual((await post(`/pantry/preps/${prep.id}/${verb}`, 'b', { portionsLeft: '0' })).status, 404, verb);
  }
  await post(`/pantry/preps/${prep.id}/portions`, 'a', { portionsLeft: '1' });
  assert.match(await (await get('/pantry', 'a')).text(), /1 of 2 left/);
  await post(`/pantry/${ids[1]}/spoiled`, 'a');
  assert.match(await (await get('/pantry', 'a')).text(), /Contains Milk, which you marked spoiled/);
  await post(`/pantry/preps/${prep.id}/portions`, 'a', { portionsLeft: '0' });
  assert.ok(!(await (await service('alpha', 60)).json()).items.some(i => i.kind === 'prep'));
});

test('the service endpoint needs the token and a named user', async () => {
  const url = '/api/service/pantry/expiring';
  assert.strictEqual((await get(url, 'a')).status, 401);
  assert.strictEqual((await get(url, null, { 'X-Service-Token': 'wrong', 'X-Service-User': 'alpha' })).status, 401);
  assert.strictEqual((await service(null)).status, 400, 'no default account for personal data');
  for (const d of ['-1', 'x', '61', '1.5']) assert.strictEqual((await service('alpha', d)).status, 400, d);
  const r = await service('alpha');
  assert.strictEqual(r.headers.get('cache-control'), 'no-store');
  const j = await r.json();
  assert.strictEqual(j.today, TODAY);
  assert.ok(j.items.every(i => i.daysLeft <= 3));
  assert.deepStrictEqual((await (await service('nobody')).json()).items, []);
});

test('OCR files are served from here, long-cached', async () => {
  const r = await get('/vendor/tesseract-7.0.0/eng.traineddata.gz');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-encoding'), null); // the worker unzips it itself
  assert.match(r.headers.get('cache-control'), /immutable/);
});

test('the public storefront has no pantry', async () => {
  const status = await new Promise((ok, no) => http.get(`${base}/pantry`,
    { headers: { Host: 'food.octopustechnology.net', Cookie: 'octopus_sso=a' } }, r => { r.resume(); ok(r.statusCode); }).on('error', no));
  assert.strictEqual(status, 404);
});
