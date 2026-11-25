'use strict';

// Plan and apply an import of recipe rows from another app's store. Additive
// only: rows are created, never updated or deleted.
//
// A row is the same row as one already here when:
//   - it was imported before: source is 'shopper:<id>', which survives a rename; or
//   - the SAME owner already has that title with the same ingredients and method.
// The same owner having that title with different content is reported, not
// imported, unless asked (`includeDiffering`). Two people's same-titled recipes
// are always two rows.

const { normalizeIngredients } = require('./recipe-ingredients');

const SOURCE_PREFIX = 'shopper:';
const sourceKey = (id) => `${SOURCE_PREFIX}${id}`;
const norm = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const steps = (v) => (Array.isArray(v) ? v.join('\n') : String(v == null ? '' : v));

function fingerprint(r) {
  const ing = normalizeIngredients(r.ingredients)
    .map((i) => norm(`${i.quantity} ${i.unit} ${i.name}`)).sort().join('|');
  return `${ing}\n${norm(steps(r.instructions))}`;
}

// A row with no recorded owner is the admin's to see, so for matching it is in
// the admin's bucket. It is never given an owner here.
function ownerBucket(owner, admin) {
  const o = String(owner || '').trim();
  return o && o !== admin ? `u:${o}` : 'admin';
}

/**
 * Published there means visible to signed-in people; published here means the
 * open internet. So only the catalogue's own reviewer carries 'public' straight
 * over, and anyone else's waits for review. `forcePrivate` keeps all private.
 */
function accessFor(row, { admin, forcePrivate }) {
  if (forcePrivate || row.visibility !== 'public') return { visibility: 'private', reviewStatus: null };
  const owner = String(row.owner || '').trim();
  if (admin && owner === admin) return { visibility: 'public', reviewStatus: 'approved' };
  return { visibility: 'private', reviewStatus: 'pending' };
}

function toValues(row, opts) {
  const list = normalizeIngredients(row.ingredients);
  const values = {
    title: String(row.title),
    servings: row.servings || 1,
    // A row whose ingredients cannot be read keeps its original text.
    ingredients: list.length ? JSON.stringify(list)
      : (typeof row.ingredients === 'string' ? row.ingredients : JSON.stringify(row.ingredients || [])),
    instructions: steps(row.instructions),
    keepsForDays: row.keepsForDays || 0,
    tags: row.tags || '',
    source: sourceKey(row.id),
    sourceUrl: row.sourceUrl || null,
    sourceContent: row.sourceContent || null,
    owner: String(row.owner || '').trim() || null,
    copiedFromAuthor: row.copiedFromAuthor || null,
    ...accessFor(row, opts),
  };
  // Row ids differ between the apps, so a copiedFrom id would point at the wrong recipe.
  if (row.createdAt && !Number.isNaN(Date.parse(row.createdAt))) values.createdAt = new Date(row.createdAt);
  return values;
}

/** rows → [{ action: 'add'|'same'|'done'|'differs'|'unreadable'|'left-out', row, reason }]. Reads only. */
async function planImport(Recipe, rows, { admin = '', includeDiffering = false, ids = null, forcePrivate = false } = {}) {
  const existing = await Recipe.findAll();
  const seenSource = new Set(existing.map((r) => r.source));
  const byTitle = new Map(); // bucket + title → Set(fingerprint)
  const put = (owner, title, fp) => {
    const k = `${ownerBucket(owner, admin)}\n${norm(title)}`;
    if (!byTitle.has(k)) byTitle.set(k, new Set());
    byTitle.get(k).add(fp);
  };
  existing.forEach((r) => put(r.owner, r.title, fingerprint(r)));

  const plan = [];
  for (const row of rows) {
    const item = { row, action: 'add', reason: '' };
    plan.push(item);
    if (ids && !ids.has(Number(row.id))) { item.action = 'left-out'; continue; }
    if (!String(row.title || '').trim()) { item.action = 'unreadable'; item.reason = 'no title'; continue; }
    if (seenSource.has(sourceKey(row.id))) { item.action = 'done'; continue; }
    const fp = fingerprint(row);
    const have = byTitle.get(`${ownerBucket(row.owner, admin)}\n${norm(row.title)}`);
    if (have && have.has(fp)) { item.action = 'same'; continue; }
    if (have && !includeDiffering) { item.action = 'differs'; continue; }
    item.values = toValues(row, { admin, forcePrivate });
    seenSource.add(item.values.source);
    put(row.owner, row.title, fp);
  }
  return plan;
}

async function applyImport(Recipe, plan) {
  const out = { added: 0, failed: [] };
  for (const item of plan) {
    if (item.action !== 'add') continue;
    try { await Recipe.create(item.values); out.added++; }
    catch (err) { out.failed.push({ row: item.row, error: err.name || 'error' }); }
  }
  return out;
}

module.exports = { planImport, applyImport, fingerprint, accessFor, sourceKey };
