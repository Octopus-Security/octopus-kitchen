'use strict';

// Copy recipes that exist only in the older shopping app's live database into
// this one. Additive and idempotent: nothing here is ever updated or deleted, a
// second run adds nothing, and the source is only read. Matching rules, owners
// and visibility: lib/recipe-import.js.
//
// DRY RUN BY DEFAULT: prints counts and every title. Add --apply to write.
//
// Two sources:
//   --from-db=<file>   a snapshot of that app's SQLite file (preferred: every
//                      user's rows, with the real owner, visibility, source link
//                      and date). Opened read-only.
//   (none)             its service API, one account at a time:
//                      --user=<name> (repeatable) or ADMIN_USERNAME. Needs
//                      SHOPPER_URL and SHOPPER_SERVICE_TOKEN. The API does not
//                      return source links or dates.
//
// Options:
//   --apply               write (otherwise nothing is written)
//   --ids=1,2,3           only these source ids
//   --include-differing   also bring in a row whose owner already has that title
//                         here with DIFFERENT content (as a second recipe)
//   --private             everything comes in private
//
// ADMIN_USERNAME must be set to the same account in both apps.

const { planImport, applyImport } = require('../lib/recipe-import');

function parseArgs(argv) {
  const o = { apply: false, includeDiffering: false, forcePrivate: process.env.MIGRATE_VISIBILITY === 'private', ids: null, fromDb: '', users: [] };
  for (const a of argv) {
    if (a === '--apply') o.apply = true;
    else if (a === '--dry-run') o.apply = false;
    else if (a === '--include-differing') o.includeDiffering = true;
    else if (a === '--private') o.forcePrivate = true;
    else if (a.startsWith('--from-db=')) o.fromDb = a.slice(10);
    else if (a.startsWith('--user=')) o.users.push(a.slice(7).trim());
    else if (/^--ids=\d+(,\d+)*$/.test(a)) o.ids = new Set(a.slice(6).split(',').map(Number));
    else throw new Error(`unknown option: ${a}`);
  }
  if (argv.includes('--dry-run') && argv.includes('--apply')) throw new Error('--dry-run and --apply together');
  return o;
}

async function rowsFromDb(file) {
  const sqlite3 = require('sqlite3');
  const db = await new Promise((resolve, reject) => {
    const h = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (e) => (e ? reject(e) : resolve(h)));
  });
  const all = (sql) => new Promise((resolve, reject) => db.all(sql, (e, r) => (e ? reject(e) : resolve(r))));
  try {
    const tables = (await all("SELECT name FROM sqlite_master WHERE type='table'")).map((t) => t.name);
    if (!tables.includes('recipes')) throw new Error('that file has no recipes table');
    const rows = await all('SELECT * FROM recipes ORDER BY id');
    const notes = [];
    // Left behind only if a schema change was interrupted half way: rows could be
    // in there and nowhere else, so say so instead of passing over it.
    for (const t of tables.filter((n) => /^recipes_backup/.test(n))) {
      const [{ n }] = await all(`SELECT COUNT(*) AS n FROM "${t.replace(/"/g, '""')}"`);
      notes.push(`the source also has a table ${t} with ${n} rows (an interrupted schema change). Keep the snapshot.`);
    }
    return { rows, notes };
  } finally {
    await new Promise((resolve) => db.close(resolve));
  }
}

async function rowsFromApi({ users, base, token, fetchImpl = fetch }) {
  if (!base) throw new Error('SHOPPER_URL is not set');
  if (!token) throw new Error('SHOPPER_SERVICE_TOKEN is not set');
  if (!users.length) throw new Error('no account: set ADMIN_USERNAME or pass --user=<name>');
  const get = async (user, p) => {
    const res = await fetchImpl(`${base.replace(/\/+$/, '')}${p}`, {
      headers: { 'X-Service-Token': token, 'X-Service-User': user },
    });
    if (!res.ok) throw new Error(`GET ${p} answered ${res.status}`);
    return res.json();
  };
  const rows = [];
  for (const user of users) {
    const list = (await get(user, '/api/recipes')).recipes || [];
    // The list does not carry visibility; a row is public when the published
    // list says so, and private otherwise.
    const published = new Set(((await get(user, '/api/public-recipes')).recipes || []).filter((r) => r.mine).map((r) => r.id));
    for (const s of list) {
      const { recipe } = await get(user, `/api/recipes/${s.id}`);
      rows.push({ ...s, ...recipe, owner: user, visibility: published.has(s.id) ? 'public' : 'private' });
    }
  }
  return { rows, notes: [] };
}

const HEADINGS = [
  ['add', 'TO ADD'],
  ['differs', 'SAME OWNER AND TITLE HERE, DIFFERENT CONTENT: not added unless --include-differing'],
  ['done', 'already imported'],
  ['same', 'already here, identical'],
  ['unreadable', 'NOT READABLE: not added'],
  ['left-out', 'not in --ids'],
];

function report(plan, log) {
  for (const [action, label] of HEADINGS) {
    const items = plan.filter((p) => p.action === action);
    log(`${label}: ${items.length}`);
    for (const { row, values, reason } of items) {
      const where = values ? `  [${values.reviewStatus === 'pending' ? 'private, waiting for review' : values.visibility}]` : '';
      log(`  #${row.id}  ${row.title || '(no title)'}  (owner: ${row.owner || 'none'})${where}${reason ? `  ${reason}` : ''}`);
    }
  }
}

async function run(argv, { log = console.log, Recipe, fetchImpl } = {}) {
  const opts = parseArgs(argv);
  const admin = (process.env.ADMIN_USERNAME || '').trim();
  if (!admin) log('WARNING: ADMIN_USERNAME is not set, so recipes with no recorded owner will be visible to nobody.');
  const users = opts.users.length ? [...new Set(opts.users)] : (admin ? [admin] : []);
  const { rows, notes } = opts.fromDb
    ? await rowsFromDb(opts.fromDb)
    : await rowsFromApi({ users, base: process.env.SHOPPER_URL, token: process.env.SHOPPER_SERVICE_TOKEN, fetchImpl });
  const plan = await planImport(Recipe, rows, { ...opts, admin });
  log(`${rows.length} recipes in the source`);
  notes.forEach((n) => log(`NOTE: ${n}`));
  report(plan, log);
  if (!opts.apply) {
    log('DRY RUN: nothing was written. Run again with --apply to add the recipes under TO ADD.');
    return { plan, added: 0, failed: [] };
  }
  const done = await applyImport(Recipe, plan);
  done.failed.forEach((f) => log(`FAILED #${f.row.id} ${f.row.title}: ${f.error}`));
  log(`ADDED ${done.added}, failed ${done.failed.length}`);
  return { plan, ...done };
}

if (require.main === module) {
  const { Recipe, sequelize } = require('../database');
  run(process.argv.slice(2), { Recipe })
    .then((r) => { if (r.failed.length) process.exitCode = 1; })
    .catch((err) => { console.error('[migrate] stopped:', err.message); process.exitCode = 1; })
    .finally(() => sequelize.close());
}

module.exports = { run, parseArgs, rowsFromDb, rowsFromApi };
