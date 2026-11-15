'use strict';

// Whether a recipe may appear on the public storefront, and how a typed
// ingredient line becomes { name, quantity, unit }. Pure: no database.

const UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'g', 'gram', 'grams', 'kg', 'lb', 'lbs', 'pound', 'pounds',
  'ml', 'l', 'liter', 'liters', 'litre', 'litres', 'pinch', 'pinches', 'clove', 'cloves',
  'can', 'cans', 'package', 'packages', 'slice', 'slices', 'piece', 'pieces',
  'bunch', 'bunches', 'handful', 'handfuls', 'quart', 'quarts', 'pint', 'pints',
  'gallon', 'gallons', 'dash', 'dashes', 'sprig', 'sprigs', 'stick', 'sticks',
]);

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3' };
const QTY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/;

function parseIngredientLine(line) {
  let raw = String(line || '').trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  raw = raw.replace(/[½¼¾⅓⅔]/g, (ch) => FRACTIONS[ch] || ch);
  const m = QTY.exec(raw);
  if (!m) return { name: raw, quantity: '', unit: '' };
  let rest = raw.slice(m[0].length).trim();
  const parts = rest.split(/\s+/);
  let unit = '';
  if (parts.length > 1 && UNITS.has(parts[0].toLowerCase().replace(/\.$/, ''))) {
    unit = parts[0].replace(/\.$/, '');
    rest = parts.slice(1).join(' ');
  }
  if (!rest) return { name: raw, quantity: '', unit: '' };
  return { name: rest, quantity: m[0].replace(/\s+/g, ' '), unit };
}

function parseIngredientLines(text) {
  return String(text || '').split(/\r?\n/).map(parseIngredientLine).filter(Boolean);
}

function requestPublic(body) {
  const src = body || {};
  const v = src.request != null ? src.request : src.visibility;
  return v === true || v === 'public' || v === 'on' || v === 'request' || v === '1';
}

// A person who is not a reviewer cannot put a recipe on the public site.
// The request stays private until a reviewer approves it.
function publishDecision({ isReviewer, requestPublic }) {
  if (!requestPublic) return { visibility: 'private', reviewStatus: null };
  if (isReviewer) return { visibility: 'public', reviewStatus: 'approved' };
  return { visibility: 'private', reviewStatus: 'pending' };
}

function toggleDecision({ isReviewer, visibility }) {
  if (visibility === 'public') return { visibility: 'private', reviewStatus: null };
  return publishDecision({ isReviewer, requestPublic: true });
}

function reviewDecision(decision) {
  if (decision === 'approve') return { visibility: 'public', reviewStatus: 'approved' };
  if (decision === 'reject') return { visibility: 'private', reviewStatus: 'rejected' };
  return null;
}

function cleanRecipe(body) {
  const src = body || {};
  const title = String(src.title || '').trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!title) return { ok: false, status: 400, error: 'Name the recipe.' };
  const lines = parseIngredientLines(src.ingredients);
  if (!lines.length) return { ok: false, status: 400, error: 'Add at least one ingredient, one per line.' };
  const instructions = String(src.instructions || '').replace(/\u0000/g, '').trim().slice(0, 8000);
  if (!instructions) return { ok: false, status: 400, error: 'Add the method.' };
  let servings = parseInt(src.servings, 10);
  if (!Number.isInteger(servings) || servings < 1) servings = 1;
  if (servings > 99) servings = 99;
  const summary = String(src.summary || '').trim().slice(0, 300);
  const tags = String(src.tags || '').trim().slice(0, 200);
  return {
    ok: true,
    requestPublic: requestPublic(src),
    recipe: {
      title,
      servings,
      ingredients: JSON.stringify(lines),
      instructions,
      tags,
      summary: summary || null,
      source: 'text',
    },
  };
}

async function createFromBody(Recipe, body, { owner, isReviewer }) {
  const clean = cleanRecipe(body);
  if (!clean.ok) return clean;
  const access = publishDecision({ isReviewer: !!isReviewer, requestPublic: clean.requestPublic });
  const row = await Recipe.create({
    ...clean.recipe,
    owner: owner || null,
    visibility: access.visibility,
    reviewStatus: access.reviewStatus,
  });
  return { ok: true, status: 201, row, access };
}

async function toggleRow(recipe, { isReviewer }) {
  const access = toggleDecision({ isReviewer: !!isReviewer, visibility: recipe.visibility });
  recipe.visibility = access.visibility;
  recipe.reviewStatus = access.reviewStatus;
  if (access.reviewStatus !== 'rejected') recipe.reviewNote = null;
  await recipe.save();
  return { ok: true, access };
}

async function reviewRow(recipe, { isReviewer, decision, note }) {
  if (!isReviewer) return { ok: false, status: 404 };
  if (!recipe || recipe.reviewStatus !== 'pending') return { ok: false, status: 404 };
  const access = reviewDecision(decision);
  if (!access) return { ok: false, status: 400, error: 'Choose approve or reject.' };
  const text = String(note || '').trim().slice(0, 500);
  recipe.visibility = access.visibility;
  recipe.reviewStatus = access.reviewStatus;
  recipe.reviewNote = access.reviewStatus === 'rejected' ? (text || null) : null;
  await recipe.save();
  return { ok: true, access };
}

module.exports = {
  parseIngredientLine, parseIngredientLines, requestPublic,
  publishDecision, toggleDecision, reviewDecision, cleanRecipe,
  createFromBody, toggleRow, reviewRow,
};
