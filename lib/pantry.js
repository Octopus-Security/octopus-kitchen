'use strict';
// Form parsing, macro sums and view rows for the pantry. Pure: no database.
const et = require('./et');
const shelf = require('./shelf-life');

const MACROS = ['kcal', 'protein', 'carbs', 'fat'];
const NUMBERS = ['servings', ...MACROS];
const MAX_ROWS = 20;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** Repeated fields arrive as a string, an array, or (past qs's limit) an indexed object. */
function list(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === 'object') return Object.keys(v).sort((a, b) => a - b).map(k => v[k]);
  return [v];
}
/** undefined: not a usable number. null: blank, which means unknown and not zero. */
function number(v, max = 100000) {
  const s = text(v, 20);
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

function customFrom(body) {
  const names = list(body.customName), values = list(body.customValue);
  const out = [];
  for (let i = 0; i < names.length && out.length < MAX_ROWS; i++) {
    const name = text(names[i], 40);
    if (name) out.push({ name, value: text(values[i], 60) }); // a blank name removes the field
  }
  return out;
}

function itemFromForm(body, today) {
  const row = {
    name: text(body.name, 120), brand: text(body.brand, 80) || null,
    category: Object.hasOwn(shelf.CATEGORIES, text(body.category, 40)) ? text(body.category, 40) : 'other',
    quantity: text(body.quantity, 60) || null, notes: text(body.notes, 1000) || null,
    servingSize: text(body.servingSize, 60) || null,
    customFields: JSON.stringify(customFrom(body)),
  };
  let error = row.name ? null : 'Give it a name.';
  for (const [key, word] of [['boughtOn', 'bought'], ['openedOn', 'opened'], ['madeOn', 'made'], ['bestBy', 'best-by']]) {
    const v = text(body[key], 10);
    row[key] = et.isDate(v) ? v : null;
    if (v && !row[key]) error = error || `The ${word} date is not a real date.`;
    if (key !== 'bestBy' && row[key] && row[key] > today) error = error || `The ${word} date is in the future.`;
  }
  for (const key of NUMBERS) {
    const n = number(body[key]);
    if (n === undefined) error = error || `${key} should be a number, zero or more.`;
    row[key] = n === undefined ? null : n;
  }
  return { row, error };
}

function parseJson(s, fallback = []) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
}

const round = n => Math.round(n * 10) / 10;
/**
 * Per-portion macros. `servings` on each ingredient is for the whole batch, in that
 * item's own label servings. A missing number is named in `missing` and leaves the total
 * low by that much; a macro nobody supplied stays null rather than a confident 0.
 */
function prepMacros(ingredients, portions) {
  const out = { missing: [] };
  for (const k of MACROS) out[k] = null;
  for (const ing of ingredients) {
    if (!(ing.servings > 0) || MACROS.some(k => ing[k] == null)) out.missing.push(ing.name);
    if (!(ing.servings > 0)) continue;
    for (const k of MACROS) if (ing[k] != null) out[k] = (out[k] || 0) + ing[k] * ing.servings;
  }
  for (const k of MACROS) if (out[k] != null) out[k] = round(out[k] / portions);
  return out;
}

const observationsFor = (all, key) => all.filter(o => o.productKey === key);

/** An item used in a prep has been opened, whether or not anyone tapped the button. */
function ingredientEstimate(item, madeOn, observations) {
  const used = item.openedOn || item.madeOn ? item : { ...plain(item), openedOn: madeOn };
  return shelf.estimate(used, observationsFor(observations, shelf.productKey(item))).goodUntil;
}
const plain = r => (r && typeof r.toJSON === 'function' ? r.toJSON() : r);

/** items: Map of this owner's own rows by id; nothing outside it can be used. */
function prepFromForm(body, items, observations, today) {
  const portionsRaw = number(body.portions, 50);
  const row = {
    name: text(body.name, 120), notes: text(body.notes, 1000) || null,
    category: body.category === 'shake' ? 'shake' : 'leftovers',
    madeOn: et.isDate(text(body.madeOn, 10)) ? text(body.madeOn, 10) : null,
    portions: Number.isInteger(portionsRaw) && portionsRaw >= 1 ? portionsRaw : null,
  };
  let error = !row.name ? 'Give it a name.'
    : !row.madeOn || row.madeOn > today ? 'Pick the day it was made, today or earlier.'
      : !row.portions ? 'Portions should be a whole number from 1 to 50.' : null;
  const ids = list(body.itemId), servings = list(body.itemServings), amounts = list(body.itemAmount);
  const ingredients = [];
  for (let i = 0; i < ids.length && ingredients.length < MAX_ROWS; i++) {
    if (!text(ids[i], 12)) continue;
    const item = items.get(Number(ids[i]));
    if (!item) { error = error || 'One of the ingredients is not in your pantry.'; continue; }
    const n = number(servings[i], 1000);
    if (n === undefined) error = error || `Servings of ${item.name} should be a number.`;
    const ing = {
      itemId: item.id, name: item.name, amount: text(amounts[i], 40), servings: n || null,
      goodUntil: ingredientEstimate(item, row.madeOn || today, observations),
    };
    for (const k of MACROS) ing[k] = item[k] ?? null;
    ingredients.push(ing);
  }
  if (!ingredients.length) error = error || 'Add at least one ingredient.';
  const { missing, ...macros } = prepMacros(ingredients, row.portions || 1);
  return { error, row: { ...row, ...macros, portionsLeft: row.portions, ingredients: JSON.stringify(ingredients), missing: JSON.stringify(missing) } };
}

const prepKey = prep => `prep|${shelf.productKey(prep)}`;

function itemView(item, observations, today) {
  const it = plain(item);
  const est = shelf.estimate(it, observationsFor(observations, shelf.productKey(it)));
  const since = it.openedOn ? `opened ${et.ago(it.openedOn, today)}` : it.madeOn ? `made ${et.ago(it.madeOn, today)}`
    : it.boughtOn ? `bought ${et.ago(it.boughtOn, today)}` : 'no dates yet';
  return { ...it, kind: 'item', ...est, since, until: et.label(est.goodUntil, today),
    urgency: shelf.urgency(est.goodUntil, today), categoryLabel: shelf.categoryOf(it.category).label,
    custom: parseJson(it.customFields) };
}

/** Re-checked on every view, so an ingredient found spoiled later still counts. */
function prepView(prep, items, observations, today) {
  const p = plain(prep);
  const ingredients = parseJson(p.ingredients);
  const dates = [];
  const spoiled = [];
  for (const ing of ingredients) {
    const item = items.get(ing.itemId);
    // The frozen date, or a sooner one if the product has been learned to spoil faster.
    const live = item ? ingredientEstimate(item, p.madeOn, observations) : null;
    dates.push({ name: ing.name, goodUntil: [ing.goodUntil, live].filter(Boolean).sort()[0] || null });
    if (item && item.status === 'spoiled') spoiled.push(ing.name);
  }
  const est = shelf.prepGoodUntil(p, dates, observationsFor(observations, prepKey(p)));
  return { ...p, kind: 'prep', ...est, ingredients, spoiled, missing: parseJson(p.missing),
    since: `made ${et.ago(p.madeOn, today)}`, until: et.label(est.goodUntil, today),
    urgency: spoiled.length ? 'past' : shelf.urgency(est.goodUntil, today) };
}

const FAR = '9999-99-99';
const bySoonest = (a, b) => (a.goodUntil || FAR).localeCompare(b.goodUntil || FAR) || a.name.localeCompare(b.name);

module.exports = { MACROS, MAX_ROWS, itemFromForm, prepFromForm, prepMacros, prepKey, itemView, prepView, bySoonest, parseJson, customFrom };
