'use strict';

// One stored shape for an ingredient: { name, quantity, unit }, the one every
// view, the safe-temp matcher and the equipment matcher read. Other writers use
// other shapes ({ item, qty } from the assistant, { name, measure } from the
// older app's API, plain strings), and those would otherwise show as blank lines.

const { parseIngredientLine, parseIngredientLines } = require('./recipe-review');

const text = (v) => (v == null ? '' : String(v).trim());

// { qty: '1 1/2 cups' } becomes quantity + unit only when the unit is a known
// one; anything else ('to taste') is kept whole in quantity, never guessed at.
function splitMeasure(measure) {
  const m = text(measure);
  if (!m) return { quantity: '', unit: '' };
  const p = parseIngredientLine(`${m} ⁣`);
  return p && p.quantity && p.name === '⁣' ? { quantity: p.quantity, unit: p.unit } : { quantity: m, unit: '' };
}

function normalizeIngredient(i) {
  if (typeof i === 'string') return parseIngredientLine(i);
  if (!i || typeof i !== 'object') return null;
  const name = text(i.name) || text(i.item) || text(i.ingredient);
  if (!name) return null;
  const quantity = text(i.quantity);
  if (quantity && quantity !== '0') return { name, quantity, unit: text(i.unit) };
  const measure = text(i.qty) || text(i.measure) || text(i.amount);
  if (measure) {
    if (text(i.unit)) return { name, quantity: measure, unit: text(i.unit) };
    return { name, ...splitMeasure(measure) };
  }
  return { name, quantity: '', unit: '' };
}

/** Anything a writer may send → [{ name, quantity, unit }]. */
function normalizeIngredients(raw) {
  let list = raw;
  if (typeof list === 'string') {
    const s = list;
    try { list = JSON.parse(s); } catch { return parseIngredientLines(s); }
  }
  if (!Array.isArray(list)) return [];
  return list.map(normalizeIngredient).filter(Boolean);
}

module.exports = { normalizeIngredients, normalizeIngredient };
